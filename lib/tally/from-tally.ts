import { isGoodsReturn } from './gr';
import type { DrCr, TallyData, TallyLedger, TallyLine, TallyParty, TallyStock, TallyVoucher } from './types';

// What the sync program (scripts/tally-sync/tally-sync.mjs) reads from
// TallyPrime and sends up, kept close to Tally's own fields. The heavy work of
// turning it into the portal's TallyData happens here, on the server, so it is
// typed and tested and the sync program stays small.
//
// Signs follow Tally's XML: a negative ledger balance is Dr (they owe you).
// An inventory line with inward = true is goods coming in (a purchase).

/** [name, parentGroup] */
export type RawGroup = [string, string];
/** [name, parentGroup, state, address, opening, closing] */
export type RawLedger = [string, string, string, string, number, number];
/** [name, parentGroup, baseUnit, openingQty, openingValue] */
export type RawStock = [string, string, string, number, number];
/** [item, qty, unit, rate, amount (always positive), inward] */
export type RawInv = [string, number, string, number, number, boolean];
/** [ledgerName, amount (Tally sign)] */
export type RawLedEntry = [string, number];
/** [guid, date YYYYMMDD, type, number, party, narration, inventory, ledgerEntries] */
export type RawVoucher = [string, string, string, string, string, string, RawInv[], RawLedEntry[]];

export type RawSync = {
  format: 'yoyo-tally-raw-1';
  company: string;
  computer: string; // which machine ran the sync
  syncedAt: string; // ISO
  fromDate: string; // YYYYMMDD
  toDate: string;
  groups: RawGroup[];
  ledgers: RawLedger[];
  stock: RawStock[];
  vouchers: RawVoucher[];
};

const isoDate = (d: string) => (/^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d);
const side = (n: number): DrCr => (Math.abs(n) < 0.005 ? '' : n < 0 ? 'Dr' : 'Cr');
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Basic shape check: a sync upload is trusted only after its key, but still mustn't crash the portal. */
export function isRawSync(x: unknown): x is RawSync {
  const r = x as RawSync;
  return !!r && r.format === 'yoyo-tally-raw-1' && Array.isArray(r.ledgers) && Array.isArray(r.vouchers) && Array.isArray(r.groups) && Array.isArray(r.stock);
}

export function fromTally(raw: RawSync): TallyData {
  // Walk each ledger's group up to its top so "China Sundry Creditors" counts as a creditor.
  const parentOf = new Map(raw.groups.map(([n, p]) => [n, p]));
  const chain = (g: string) => {
    const out: string[] = [];
    let cur = g;
    for (let i = 0; cur && i < 20 && !out.includes(cur); i++) { out.push(cur); cur = parentOf.get(cur) || ''; }
    return out;
  };
  const isPartyGroup = (g: string) => chain(g).some((x) => /^(sundry debtors|sundry creditors|bad debt|loans & advances \(asset\))$/i.test(x));
  // Cash and bank ledgers can be a voucher's "party" in Tally, but they are not
  // people: their balance belongs in Bank and cash, not in who-owes-whom.
  const isMoneyGroup = (g: string) => chain(g).some((x) => /^(cash-in-hand|bank accounts|bank od a\/c)$/i.test(x));

  const ledgerByName = new Map(raw.ledgers.map((l) => [l[0].toLowerCase(), l]));
  const voucherParties = new Set(raw.vouchers.map((v) => v[4].toLowerCase()).filter(Boolean));

  const parties: TallyParty[] = [];
  const partyIndex = new Map<string, number>();
  const addParty = (name: string): number => {
    const k = name.toLowerCase();
    const have = partyIndex.get(k);
    if (have !== undefined) return have;
    const l = ledgerByName.get(k);
    const money = l ? isMoneyGroup(l[1]) : false;
    const op = money ? 0 : l?.[4] || 0;
    const cl = money ? 0 : l?.[5] || 0;
    partyIndex.set(k, parties.length);
    parties.push({
      name: l ? l[0] : name, group: l ? l[1] : '', role: '', state: l?.[2] || '', address: l?.[3] || '',
      opening: Math.abs(op), openingType: side(op), closing: Math.abs(cl), closingType: side(cl),
      purchased: 0, sold: 0, paidNoStock: 0, receivedNoStock: 0, vouchers: 0, lastTxn: ''
    });
    return parties.length - 1;
  };
  for (const l of raw.ledgers) if (isPartyGroup(l[1]) || (voucherParties.has(l[0].toLowerCase()) && !isMoneyGroup(l[1]))) addParty(l[0]);

  const items: string[] = [];
  const itemIndex = new Map<string, number>();
  const itemOf = (n: string) => {
    const k = n.toLowerCase();
    let i = itemIndex.get(k);
    if (i === undefined) { i = items.length; items.push(n); itemIndex.set(k, i); }
    return i;
  };

  const sales: TallyLine[] = [];
  const purchases: TallyLine[] = [];
  const returns: TallyLine[] = [];
  const vouchers: TallyVoucher[] = [];
  // Per stock item: [inQty, inValue, outQty, outValue, lastBuyRate, lastBuyDate, lastSellRate, lastSellDate]
  const moves = new Map<string, [number, number, number, number, number, string, number, string]>();

  const sorted = [...raw.vouchers].sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  for (const [, d, type, vno, partyName, narration, inv, led] of sorted) {
    if (!partyName) continue;
    const date = isoDate(d);
    const p = addParty(partyName);
    const party = parties[p];
    const narr = narration.trim();

    // Lines with no quantity (e.g. "Round Off") are adjustments, not goods.
    const goods = inv.filter(([, q]) => q > 0);
    let stockValue = 0;
    for (const [item, q, unit, rate, amount, inward] of goods) {
      const line: TallyLine = [date, vno, p, itemOf(item), q, unit, rate, r2(amount), narr];
      stockValue += amount;
      if (inward) { purchases.push(line); party.purchased += amount; }
      else if (isGoodsReturn(vno)) returns.push(line);
      else { sales.push(line); party.sold += amount; }

      const m = moves.get(item.toLowerCase()) || [0, 0, 0, 0, 0, '', 0, ''];
      if (inward) { m[0] += q; m[1] += amount; if (date >= m[5]) { m[4] = rate; m[5] = date; } }
      else { m[2] += q; m[3] += amount; if (date >= m[7]) { m[6] = rate; m[7] = date; } }
      moves.set(item.toLowerCase(), m);
    }

    const own = led.find(([n]) => n.toLowerCase() === partyName.toLowerCase());
    const amount = Math.abs(own ? own[1] : led.reduce((t, [, a]) => t + Math.max(0, a), 0));
    const others = led.filter(([n]) => n.toLowerCase() !== partyName.toLowerCase())
      .map(([n, a]) => `${n} ${Math.abs(a).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`).join('; ');
    if (!goods.length) {
      if (/receipt/i.test(type)) party.receivedNoStock += amount;
      else if (/payment/i.test(type)) party.paidNoStock += amount;
    }
    party.vouchers += 1;
    if (date > party.lastTxn) party.lastTxn = date;
    vouchers.push([date, type, vno, p, party.group, r2(amount), goods.length, r2(stockValue), others, narr]);
  }

  // Stock in hand = opening + goods in − goods out. Value at average cost
  // (opening plus purchases), which is how Tally values stock by default. This
  // avoids asking Tally to calculate closing stock, which is very slow.
  const stock: TallyStock[] = raw.stock.map(([name, group, unit, oq, ov]) => {
    const m = moves.get(name.toLowerCase()) || [0, 0, 0, 0, 0, '', 0, ''];
    const cq = oq + m[0] - m[2];
    const costQty = oq + m[0];
    const avg = costQty > 0 ? (ov + m[1]) / costQty : 0;
    return [name, group, unit, oq, r2(ov), r2(cq), r2(Math.max(0, cq) * avg), m[0], r2(m[1]), m[4], m[5], m[2], r2(m[3]), m[6], m[7]];
  });

  const ledgers: TallyLedger[] = raw.ledgers
    .filter((l) => !partyIndex.has(l[0].toLowerCase()) || isMoneyGroup(l[1]))
    .map((l) => [l[0], l[1], l[2], Math.abs(l[5]), side(l[5])]);

  const dates = vouchers.map((v) => v[0]).filter(Boolean).sort();
  return {
    version: 1,
    meta: {
      company: raw.company,
      note: `Live from Tally on ${raw.computer}`,
      fileName: `Live sync from ${raw.computer}`,
      uploadedAt: raw.syncedAt,
      firstDate: dates[0] || isoDate(raw.fromDate),
      lastDate: dates[dates.length - 1] || isoDate(raw.toDate)
    },
    parties, items, sales, purchases, returns, vouchers, stock, ledgers
  };
}
