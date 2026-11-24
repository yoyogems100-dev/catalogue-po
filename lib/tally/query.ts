import type { TallyData, TallyLine, TallyParty } from './types';
import { isGoodsReturn } from './gr';
import { daysBetween, rupees, rupeesShort, day, month } from './format';

// Everything the Tally portal knows how to answer, computed in the browser
// from the uploaded snapshot. No data leaves the page and nothing is sent to
// an AI service: questions are understood with plain keyword rules, and any
// question the rules don't recognise falls back to a search of everything.
//
// Tally terms are turned into plain words throughout: a party with a Dr
// closing balance "owes you"; Cr means "you owe them".
//
// In this company's books goods move inside Receipt/Payment vouchers: a
// Receipt with stock lines is a sale (goods out), a Payment with stock lines
// is a purchase (goods in) — see the Summary sheet of the extract.

export type Lines = 'sales' | 'purchases' | 'returns';

export type PartyAgg = {
  sales: number[]; // indexes into data.sales
  purchases: number[];
  returns: number[];
  vouchers: number[];
  salesAmt: number;
  purchAmt: number;
  returnsAmt: number;
  orders: number; // distinct sale vouchers
  firstSale: string;
  lastSale: string;
  lastPurchase: string;
  lastActivity: string;
};

export type TallyIndex = {
  data: TallyData;
  agg: PartyAgg[];
  partyKey: string[]; // normalised names
  itemKey: string[];
  stockKey: string[];
  itemGroup: string[]; // per item index, from Stock Items (or '')
  today: string; // last date in the data
};

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9#*.]+/g, ' ').replace(/\s+/g, ' ').trim();

export function buildIndex(input: TallyData): TallyIndex {
  const data: TallyData = { ...input, returns: input.returns || [] };
  const agg: PartyAgg[] = data.parties.map(() => ({
    sales: [], purchases: [], returns: [], vouchers: [], salesAmt: 0, purchAmt: 0, returnsAmt: 0, orders: 0, firstSale: '', lastSale: '', lastPurchase: '', lastActivity: ''
  }));
  const later = (a: string, b: string) => (b > a ? b : a);
  const saleVouchers = new Map<number, Set<string>>();
  data.sales.forEach((l, i) => {
    const a = agg[l[2]];
    if (!a) return;
    a.sales.push(i); a.salesAmt += l[7];
    if (!a.firstSale || l[0] < a.firstSale) a.firstSale = l[0];
    a.lastSale = later(a.lastSale, l[0]);
    a.lastActivity = later(a.lastActivity, l[0]);
    let s = saleVouchers.get(l[2]); if (!s) saleVouchers.set(l[2], (s = new Set()));
    s.add(`${l[0]}|${l[1]}`);
  });
  saleVouchers.forEach((s, p) => { agg[p].orders = s.size; });
  data.purchases.forEach((l, i) => {
    const a = agg[l[2]];
    if (!a) return;
    a.purchases.push(i); a.purchAmt += l[7];
    a.lastPurchase = later(a.lastPurchase, l[0]);
    a.lastActivity = later(a.lastActivity, l[0]);
  });
  (data.returns || []).forEach((l, i) => {
    const a = agg[l[2]];
    if (!a) return;
    a.returns.push(i); a.returnsAmt += l[7];
    a.lastActivity = later(a.lastActivity, l[0]);
  });
  data.vouchers.forEach((v, i) => {
    const a = agg[v[3]];
    if (!a) return;
    a.vouchers.push(i);
    a.lastActivity = later(a.lastActivity, v[0]);
  });
  agg.forEach((a, i) => { if (!a.lastActivity) a.lastActivity = data.parties[i].lastTxn; });

  const stockGroup = new Map(data.stock.map((s) => [s[0].toLowerCase(), s[1]]));
  return {
    data,
    agg,
    partyKey: data.parties.map((p) => norm(p.name)),
    itemKey: data.items.map(norm),
    stockKey: data.stock.map((s) => norm(`${s[0]} ${s[1]}`)),
    itemGroup: data.items.map((n) => stockGroup.get(n.toLowerCase()) || ''),
    today: data.meta.lastDate || new Date().toISOString().slice(0, 10)
  };
}

/* ---------------- balances in plain words ---------------- */

export type Balance = { amount: number; side: 'owes-you' | 'you-owe' | 'settled'; words: string };

export function balanceOf(p: Pick<TallyParty, 'closing' | 'closingType'>): Balance {
  const amount = Math.abs(p.closing || 0);
  if (amount < 1) return { amount: 0, side: 'settled', words: 'Settled — nothing due' };
  if (p.closingType === 'Cr') return { amount, side: 'you-owe', words: `You owe them ${rupees(amount)}` };
  return { amount, side: 'owes-you', words: `They owe you ${rupees(amount)}` };
}

export const isBadDebt = (p: TallyParty) => /bad debt/i.test(p.group);

/** Customer / Supplier / Both, from what actually happened, falling back to the ledger group. */
export function roleOf(ix: TallyIndex, i: number): 'Customer' | 'Supplier' | 'Customer & supplier' | 'Party' {
  const a = ix.agg[i];
  const p = ix.data.parties[i];
  // From the actual item lines (the Parties sheet's "Sold" includes GR returns).
  const buys = a.sales.length > 0;
  const sells = a.purchases.length > 0;
  if (buys && sells) return 'Customer & supplier';
  if (buys) return 'Customer';
  if (sells) return 'Supplier';
  if (/creditor/i.test(p.group)) return 'Supplier';
  if (/debtor/i.test(p.group)) return 'Customer';
  return 'Party';
}

/* ---------------- fuzzy search ---------------- */

// Words that appear in many party names and say little on their own.
const WEAK = new Set(['ji', 'bhai', 'sir', 'and', 'the', 'co', 'gems', 'gem', 'jewellers', 'jewels', 'jewel', 'jpr', 'jaipur', 'mumbai', 'delhi', 'new', 'old', 'b21', '22', 'india', 'china', 'x', 'enterprises', 'traders', 'trading', 'company', 'sons']);

function tokens(s: string) { return norm(s).split(' ').filter(Boolean); }

/** Score how well `query` matches a normalised name: 0 = no match. */
export function nameScore(query: string, key: string): number {
  const q = norm(query);
  if (!q) return 0;
  if (key === q) return 100;
  let score = 0;
  if (key.startsWith(q)) score = 80;
  else if (key.includes(q)) score = 60;
  const kt = key.split(' ');
  const qt = q.split(' ');
  let hits = 0;
  for (const t of qt) {
    if (kt.some((k) => k === t)) hits += 1;
    else if (t.length >= 2 && kt.some((k) => k.startsWith(t))) hits += 0.8;
    else if (t.length >= 3 && key.includes(t)) hits += 0.5;
    else if (t.length >= 4 && kt.some((k) => k.length >= 4 && editWithin1(k, t))) hits += 0.6;
  }
  if (hits >= qt.length * 0.999) score = Math.max(score, 50 + hits);
  else if (hits > 0) score = Math.max(score, (hits / qt.length) * 40);
  return score;
}

/** True if a and b differ by at most one insert, delete or substitution (catches small typos). */
function editWithin1(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export function searchParties(ix: TallyIndex, q: string, limit = 30): number[] {
  if (!norm(q)) return [];
  return ix.partyKey.map((k, i) => [i, nameScore(q, k)] as const)
    .filter(([, s]) => s >= 30)
    .sort((a, b) => b[1] - a[1] || ix.agg[b[0]].salesAmt - ix.agg[a[0]].salesAmt)
    .slice(0, limit).map(([i]) => i);
}

/** Item names (from sale/purchase lines) whose words all appear: "nano ps" → every Nano Ps size. */
export function matchItems(ix: TallyIndex, q: string): number[] {
  const qt = tokens(q);
  if (!qt.length) return [];
  const out: number[] = [];
  ix.itemKey.forEach((k, i) => {
    const hay = `${k} ${norm(ix.itemGroup[i])}`;
    if (qt.every((t) => hay.includes(t))) out.push(i);
  });
  return out;
}

export function searchStock(ix: TallyIndex, q: string, limit = 60): number[] {
  const qt = tokens(q);
  if (!qt.length) return [];
  const out: [number, number][] = [];
  ix.stockKey.forEach((k, i) => {
    if (qt.every((t) => k.includes(t))) out.push([i, ix.data.stock[i][6]]);
  });
  return out.sort((a, b) => b[1] - a[1]).slice(0, limit).map(([i]) => i);
}

/**
 * Parties named inside a sentence ("what does akshay mumbai buy"), best first.
 * `itemish` is true when every word that matched is also an item/stone word
 * (e.g. "mozonite" in "Mozonite Wuzhou"), so the caller can prefer an item answer.
 */
export function findPartiesIn(ix: TallyIndex, sentence: string): { parties: number[]; itemish: boolean } {
  const words = [...new Set(tokens(sentence))];
  const scored: { i: number; s: number; matched: string[] }[] = [];
  ix.partyKey.forEach((k, i) => {
    const kt = k.split(' ').filter(Boolean);
    let strong = 0, weak = 0, total = 0;
    const matched: string[] = [];
    kt.forEach((t, pos) => {
      const isWeak = WEAK.has(t) || t.length < 3;
      total += isWeak ? 0.3 : 1;
      const w = words.find((w) => w === t) ?? (!isWeak && t.length >= 4 ? words.find((w) => w.length >= 4 && (editWithin1(w, t) || (w.length >= 5 && t.startsWith(w)))) : undefined);
      if (w === undefined) return;
      if (isWeak) weak += 0.3; else { strong += 1 + (pos === 0 ? 0.15 : 0); matched.push(t); }
    });
    if (!strong) return;
    const s = (strong + weak) / total + strong * 0.05 + Math.min(ix.agg[i].salesAmt + ix.agg[i].purchAmt, 1e7) / 1e9;
    if (s >= 0.3) scored.push({ i, s, matched });
  });
  scored.sort((a, b) => b.s - a.s);
  if (!scored.length) return { parties: [], itemish: false };
  const top = scored[0];
  // Keep close runners-up so the page can offer "did you mean".
  const parties = scored.filter((x) => x.s >= top.s - 0.2).slice(0, 6).map((x) => x.i);
  const vocab = itemVocab(ix);
  return { parties, itemish: top.matched.every((t) => vocab.has(t)) };
}

export function findPartyIn(ix: TallyIndex, sentence: string): number | null {
  return findPartiesIn(ix, sentence).parties[0] ?? null;
}

const vocabCache = new WeakMap<TallyIndex, Set<string>>();
function itemVocab(ix: TallyIndex): Set<string> {
  let v = vocabCache.get(ix);
  if (!v) {
    v = new Set();
    for (const k of ix.itemKey) for (const t of k.split(' ')) if (t.length >= 3 && /[a-z]/.test(t)) v.add(t);
    for (const s of ix.data.stock) for (const t of norm(`${s[0]} ${s[1]}`).split(' ')) if (t.length >= 3 && /[a-z]/.test(t)) v.add(t);
    vocabCache.set(ix, v);
  }
  return v;
}

/* ---------------- what a party buys ---------------- */

export type ItemAgg = { item: number; times: number; qty: Map<string, number>; amount: number; last: string; lastRate: number; firstDate: string };

export function itemsFor(ix: TallyIndex, lineIdx: number[], kind: Lines): ItemAgg[] {
  const rows = ix.data[kind];
  const m = new Map<number, ItemAgg & { days: Set<string> }>();
  for (const li of lineIdx) {
    const l = rows[li];
    let a = m.get(l[3]);
    if (!a) m.set(l[3], (a = { item: l[3], times: 0, qty: new Map(), amount: 0, last: '', lastRate: 0, firstDate: l[0], days: new Set() }));
    a.days.add(`${l[0]}|${l[1]}`);
    a.qty.set(l[5], (a.qty.get(l[5]) || 0) + l[4]);
    a.amount += l[7];
    if (l[0] >= a.last) { a.last = l[0]; a.lastRate = l[6]; }
    if (l[0] < a.firstDate) a.firstDate = l[0];
  }
  return [...m.values()].map(({ days, ...a }) => ({ ...a, times: days.size })).sort((a, b) => b.times - a.times || b.amount - a.amount);
}

export function groupsFor(ix: TallyIndex, lineIdx: number[], kind: Lines): { group: string; amount: number }[] {
  const rows = ix.data[kind];
  const m = new Map<string, number>();
  for (const li of lineIdx) { const l = rows[li]; const g = ix.itemGroup[l[3]] || 'Other'; m.set(g, (m.get(g) || 0) + l[7]); }
  return [...m.entries()].map(([group, amount]) => ({ group, amount })).sort((a, b) => b.amount - a.amount);
}

export function monthly(ix: TallyIndex, lineIdx: number[], kind: Lines): { month: string; amount: number }[] {
  const rows = ix.data[kind];
  const m = new Map<string, number>();
  for (const li of lineIdx) { const l = rows[li]; const k = l[0].slice(0, 7); m.set(k, (m.get(k) || 0) + l[7]); }
  return [...m.entries()].sort().map(([month, amount]) => ({ month, amount }));
}

/** Lines grouped into orders (one voucher = one order), newest first. */
export type Order = { date: string; vno: string; party: number; lines: TallyLine[]; amount: number };
export function ordersFrom(ix: TallyIndex, lineIdx: number[], kind: Lines): Order[] {
  const rows = ix.data[kind];
  const m = new Map<string, Order>();
  for (const li of lineIdx) {
    const l = rows[li];
    const k = `${l[0]}|${l[1]}|${l[2]}`;
    let o = m.get(k);
    if (!o) m.set(k, (o = { date: l[0], vno: l[1], party: l[2], lines: [], amount: 0 }));
    o.lines.push(l); o.amount += l[7];
  }
  return [...m.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Average days between orders, or null with fewer than two orders. */
export function orderGap(orders: Order[]): number | null {
  const dates = [...new Set(orders.map((o) => o.date))].sort();
  if (dates.length < 2) return null;
  return Math.round(daysBetween(dates[0], dates[dates.length - 1]) / (dates.length - 1));
}

/** Which item lines belong to a voucher with stock: sales, purchases or goods returns. */
export function voucherKind(type: string, stockLines: number, vno: string): Lines | null {
  if (stockLines <= 0) return null;
  if (/receipt/i.test(type)) return isGoodsReturn(vno) ? 'returns' : 'sales';
  return 'purchases';
}

/** Plain-language voucher label. */
export function voucherLabel(type: string, stockLines: number, vno = ''): string {
  if (/receipt/i.test(type) && stockLines > 0 && isGoodsReturn(vno)) return 'Goods return (GR)';
  if (/receipt/i.test(type)) return stockLines > 0 ? 'Sale (goods out)' : 'Money received';
  if (/payment/i.test(type)) return stockLines > 0 ? 'Purchase (goods in)' : 'Money paid';
  return type || 'Entry';
}

/* ---------------- dates in questions ---------------- */

const MONTH_WORDS: Record<string, number> = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };

const iso = (d: Date) => d.toISOString().slice(0, 10);
function addDays(s: string, n: number) { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
function monthRange(y: number, m: number): [string, string] {
  const from = `${y}-${String(m).padStart(2, '0')}-01`;
  const end = new Date(Date.UTC(y, m, 0));
  return [from, iso(end)];
}

/** A date range mentioned in a question, relative to `today` (YYYY-MM-DD). */
export function dateRangeIn(q: string, today: string): { from: string; to: string; label: string } | null {
  const s = q.toLowerCase();
  const [ty, tm] = today.split('-').map(Number);
  if (/\btoday\b/.test(s)) return { from: today, to: today, label: `today (${day(today)})` };
  if (/\byesterday\b/.test(s)) { const d = addDays(today, -1); return { from: d, to: d, label: `yesterday (${day(d)})` }; }
  let m = s.match(/\blast (\d{1,3}) days?\b/);
  if (m) { const from = addDays(today, -(Number(m[1]) - 1)); return { from, to: today, label: `the last ${m[1]} days` }; }
  if (/\bthis week\b/.test(s)) return { from: addDays(today, -6), to: today, label: 'the last 7 days' };
  if (/\blast week\b/.test(s)) return { from: addDays(today, -13), to: addDays(today, -7), label: 'last week' };
  if (/\bthis month\b/.test(s)) { const [f, t] = monthRange(ty, tm); return { from: f, to: t, label: month(f) }; }
  if (/\blast month\b/.test(s)) { const y = tm === 1 ? ty - 1 : ty; const mo = tm === 1 ? 12 : tm - 1; const [f, t] = monthRange(y, mo); return { from: f, to: t, label: month(f) }; }
  if (/\b(this year|this fy|financial year|whole year|all time|so far)\b/.test(s)) return null;
  m = s.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b(?:\s+(\d{4}))?/);
  if (m) {
    const mo = MONTH_WORDS[m[1]];
    // Without a year, the most recent such month that isn't in the future.
    const y = m[2] ? Number(m[2]) : (mo > tm ? ty - 1 : ty);
    const [f, t] = monthRange(y, mo);
    return { from: f, to: t, label: month(f) };
  }
  m = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
  if (m) { const d = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return { from: d, to: d, label: day(d) }; }
  return null;
}

/* ---------------- answering questions ---------------- */

export type PartyRow = { party: number; value: number; note?: string };
export type ItemPartyRow = { party: number; times: number; qty: Map<string, number>; amount: number; last: string; lastRate: number };

export type Answer =
  | { kind: 'party'; title: string; summary: string; party: number; others: number[] }
  | { kind: 'parties'; title: string; summary: string; rows: PartyRow[]; valueLabel: string; tone?: 'owes-you' | 'you-owe' | 'neutral' }
  | { kind: 'itemParties'; title: string; summary: string; query: string; items: number[]; rows: ItemPartyRow[]; mode: Lines }
  | { kind: 'stock'; title: string; summary: string; rows: number[] }
  | { kind: 'period'; title: string; summary: string; from: string; to: string; sales: number; purchases: number; returns: number; received: number; paid: number; vouchers: number[]; topCustomers: PartyRow[] }
  | { kind: 'ledgers'; title: string; summary: string; rows: number[] }
  | { kind: 'search'; title: string; summary: string; parties: number[]; stock: number[]; vouchers: number[] };

const STOP = /\b(what|which|who|whom|whose|does|do|did|is|are|was|were|the|a|an|of|for|to|from|me|my|i|we|our|us|you|your|show|tell|give|list|find|all|any|about|please|pls|how|much|many|in|on|at|with|has|have|had|usually|generally|mostly|normally|buy|buys|bought|buying|purchase|purchases|purchased|order|orders|ordered|sell|sells|sold|selling|supply|supplies|supplied|supplier|suppliers|customer|customers|buyer|buyers|party|parties|stock|item|items|rate|rates|price|prices|last|latest|recent|history|details|detail|profile|balance|ledger|account|statement|that|this|by|ji)\b/g;

function stripWords(q: string) { return norm(q.replace(STOP, ' ')); }

function partyRows(ix: TallyIndex, filter: (p: TallyParty, i: number) => boolean, value: (p: TallyParty, i: number) => number): PartyRow[] {
  return ix.data.parties.map((p, i) => ({ party: i, value: filter(p, i) ? value(p, i) : 0 })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
}

function itemParties(ix: TallyIndex, items: number[], mode: Lines): ItemPartyRow[] {
  const set = new Set(items);
  const m = new Map<number, ItemPartyRow & { days: Set<string> }>();
  for (const l of ix.data[mode]) {
    if (!set.has(l[3])) continue;
    let r = m.get(l[2]);
    if (!r) m.set(l[2], (r = { party: l[2], times: 0, qty: new Map(), amount: 0, last: '', lastRate: 0, days: new Set() }));
    r.days.add(`${l[0]}|${l[1]}`);
    r.qty.set(l[5], (r.qty.get(l[5]) || 0) + l[4]);
    r.amount += l[7];
    if (l[0] >= r.last) { r.last = l[0]; r.lastRate = l[6]; }
  }
  return [...m.values()].map(({ days, ...r }) => ({ ...r, times: days.size })).sort((a, b) => b.amount - a.amount);
}

export function periodAnswer(ix: TallyIndex, from: string, to: string, label: string): Answer {
  const inRange = (d: string) => d >= from && d <= to;
  let sales = 0, purchases = 0, received = 0, paid = 0, returns = 0;
  const byCustomer = new Map<number, number>();
  ix.data.sales.forEach((l) => { if (inRange(l[0])) { sales += l[7]; byCustomer.set(l[2], (byCustomer.get(l[2]) || 0) + l[7]); } });
  ix.data.purchases.forEach((l) => { if (inRange(l[0])) purchases += l[7]; });
  ix.data.returns.forEach((l) => { if (inRange(l[0])) returns += l[7]; });
  const vouchers: number[] = [];
  ix.data.vouchers.forEach((v, i) => {
    if (!inRange(v[0])) return;
    vouchers.push(i);
    if (v[6] === 0 && /receipt/i.test(v[1])) received += v[5];
    if (v[6] === 0 && /payment/i.test(v[1])) paid += v[5];
  });
  vouchers.sort((a, b) => (ix.data.vouchers[b][0] > ix.data.vouchers[a][0] ? 1 : -1));
  const topCustomers = [...byCustomer.entries()].map(([party, value]) => ({ party, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  const outOfData = to < ix.data.meta.firstDate || from > ix.data.meta.lastDate;
  return {
    kind: 'period', title: `Business in ${label}`,
    summary: outOfData
      ? `Your Tally data only covers ${day(ix.data.meta.firstDate)} to ${day(ix.data.meta.lastDate)}, so there is nothing for ${label}.`
      : `In ${label} you sold goods worth ${rupees(sales)} and bought goods worth ${rupees(purchases)}.${returns ? ` ${rupees(returns)} of goods went back as returns (GR).` : ''} You received ${rupees(received)} in payments and paid out ${rupees(paid)}. ${vouchers.length} entries in total.`,
    from, to, sales, purchases, returns, received, paid, vouchers, topCustomers
  };
}

/** Answer a plain-English question about the Tally data. */
export function ask(ix: TallyIndex, question: string): Answer {
  const q = question.trim();
  const s = ` ${q.toLowerCase()} `;
  const { parties } = ix.data;

  // Money owed — "who owes me", "outstanding", "dues", "receivable"
  if (/\b(owes? me|owe us|owes us|outstanding|receivable|dues?|pending payment|to receive|to collect|recover)\b/.test(s) && !/\b(i|we) owe\b/.test(s)) {
    const rows = partyRows(ix, (p) => p.closingType !== 'Cr' && !isBadDebt(p), (p) => Math.abs(p.closing));
    const total = rows.reduce((t, r) => t + r.value, 0);
    return { kind: 'parties', title: 'Who owes you money', tone: 'owes-you', valueLabel: 'They owe you', rows,
      summary: `${rows.length} parties owe you a total of ${rupees(total)} (bad debts not included). The biggest is ${rows[0] ? `${parties[rows[0].party].name} at ${rupees(rows[0].value)}` : '—'}.` };
  }
  // Money you owe — "who do I owe", "payable", "to pay"
  if (/\b((i|we) owe|payable|to pay|have to pay|need to pay|creditors? balance)\b/.test(s)) {
    const rows = partyRows(ix, (p) => p.closingType === 'Cr', (p) => Math.abs(p.closing));
    const total = rows.reduce((t, r) => t + r.value, 0);
    return { kind: 'parties', title: 'Who you owe money to', tone: 'you-owe', valueLabel: 'You owe them', rows,
      summary: `You owe ${rows.length} parties a total of ${rupees(total)}. The biggest is ${rows[0] ? `${parties[rows[0].party].name} at ${rupees(rows[0].value)}` : '—'}.` };
  }
  if (/\b(goods returns?|returns|returned goods|gr entries)\b/.test(s) || (/^\s*gr\s*$/.test(s))) {
    const rows = ix.data.parties.map((_, i) => ({ party: i, value: ix.agg[i].returnsAmt, note: `${ix.agg[i].returns.length} lines` })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
    const total = rows.reduce((t, r) => t + r.value, 0);
    return { kind: 'parties', title: 'Goods returns (GR)', valueLabel: 'Returned', tone: 'neutral', rows,
      summary: `${rupees(total)} of goods went back to ${rows.length} parties on vouchers marked GR. These are kept apart from sales.` };
  }
  if (/\bbad debts?\b/.test(s)) {
    const rows = partyRows(ix, (p) => isBadDebt(p), (p) => Math.abs(p.closing));
    const total = rows.reduce((t, r) => t + r.value, 0);
    return { kind: 'parties', title: 'Bad debts', tone: 'owes-you', valueLabel: 'Still owed', rows, summary: `${rows.length} bad-debt accounts with ${rupees(total)} still unpaid.` };
  }
  // Bank and cash
  if (/\b(bank|cash in hand|cash balance|cash)\b/.test(s) && !findPartiesIn(ix, q).parties.length) {
    const rows = ix.data.ledgers.map((l, i) => [l, i] as const).filter(([l]) => /bank|cash/i.test(l[1])).map(([, i]) => i);
    return { kind: 'ledgers', title: 'Bank and cash', summary: 'Closing balances of your bank and cash ledgers in Tally.', rows };
  }

  const range = dateRangeIn(q, ix.today);
  const wantsTop = /\b(top|best|biggest|largest|most|highest|main|regular)\b/.test(s);
  const aboutSuppliers = /\b(suppliers?|vendors?|bought from|buy from|purchased? from|who supplies|supplied by|sellers?)\b/.test(s);

  // Top customers / suppliers (optionally in a period)
  if (wantsTop && /\b(customers?|buyers?|clients?|parties)\b/.test(s) && !aboutSuppliers) {
    const totals = new Map<number, number>();
    ix.data.sales.forEach((l) => { if (!range || (l[0] >= range.from && l[0] <= range.to)) totals.set(l[2], (totals.get(l[2]) || 0) + l[7]); });
    const rows = [...totals.entries()].map(([party, value]) => ({ party, value, note: `${ix.agg[party].orders} orders` })).sort((a, b) => b.value - a.value);
    return { kind: 'parties', title: `Top customers${range ? ` — ${range.label}` : ''}`, valueLabel: 'Bought from you', tone: 'neutral', rows,
      summary: rows.length ? `${parties[rows[0].party].name} bought the most: ${rupees(rows[0].value)}. ${rows.length} customers bought goods${range ? ` in ${range.label}` : ' in this period'}.` : 'No sales found.' };
  }
  if (wantsTop && aboutSuppliers && !stripWords(q.replace(/\b(top|best|biggest|largest|most|highest|main|regular)\b/gi, ''))) {
    const totals = new Map<number, number>();
    ix.data.purchases.forEach((l) => { if (!range || (l[0] >= range.from && l[0] <= range.to)) totals.set(l[2], (totals.get(l[2]) || 0) + l[7]); });
    const rows = [...totals.entries()].map(([party, value]) => ({ party, value })).sort((a, b) => b.value - a.value);
    return { kind: 'parties', title: `Top suppliers${range ? ` — ${range.label}` : ''}`, valueLabel: 'You bought', tone: 'neutral', rows,
      summary: rows.length ? `You bought the most from ${parties[rows[0].party].name}: ${rupees(rows[0].value)}.` : 'No purchases found.' };
  }
  // Quiet customers — "not ordered", "inactive", "lost"
  if (/\b(inactive|dormant|not (?:ordered|bought)|haven'?t (?:ordered|bought)|stopped|lost customers?|no orders?)\b/.test(s)) {
    const rows = ix.data.parties.map((p, i) => ({ party: i, value: Math.abs(p.closing), note: ix.agg[i].lastSale ? `Last bought ${day(ix.agg[i].lastSale)}` : 'No purchase this year' }))
      .filter((r) => {
        const a = ix.agg[r.party];
        const p = parties[r.party];
        const customer = a.sales.length > 0 || /debtor/i.test(p.group);
        return customer && !isBadDebt(p) && (!a.lastSale || daysBetween(a.lastSale, ix.today) > 45);
      })
      .sort((a, b) => b.value - a.value);
    return { kind: 'parties', title: 'Customers who have gone quiet', valueLabel: 'Balance', tone: 'neutral', rows,
      summary: `${rows.length} customers have not bought anything in the last 45 days (or at all this year). Biggest balances first.` };
  }

  // A named party → their profile. If the only word that matched is a stone
  // or item word ("mozonite", "pearl"), try the item answer first.
  const named = findPartiesIn(ix, q);
  const partyAnswer = (): Answer | null => {
    const hit = named.parties[0];
    return hit === undefined ? null : { kind: 'party', title: parties[hit].name, summary: partySummary(ix, hit), party: hit, others: named.parties.slice(1) };
  };
  if (named.parties.length && !named.itemish) return partyAnswer()!;

  // Item questions — "who buys nano ps", "suppliers of mozonite", "stock of pearl 4mm"
  const rest = stripWords(q.replace(/\b(top|best|biggest|largest|most|highest|main|regular|who|vendors?|sellers?)\b/gi, ' '));
  const wantsStock = /\b(stock|in hand|available|left|closing|inventory|how much|how many)\b/.test(s);
  if (rest) {
    if (wantsStock) {
      const rows = searchStock(ix, rest);
      if (rows.length) {
        const value = rows.reduce((t, i) => t + ix.data.stock[i][6], 0);
        return { kind: 'stock', title: `Stock: “${rest}”`, rows, summary: `${rows.length}${rows.length === 60 ? '+' : ''} stock items match, with ${rupees(value)} of closing stock between them.` };
      }
    }
    const items = matchItems(ix, rest);
    if (items.length) {
      const mode: Lines = aboutSuppliers ? 'purchases' : /\b(who|buyers?|customers?|sold|sell)\b/.test(s) || !/\b(bought|purchased?)\b/.test(s) ? 'sales' : 'purchases';
      const rows = itemParties(ix, items, mode);
      // If nobody bought it from you, show who you buy it from instead (most of the book is purchases).
      const finalMode: Lines = rows.length || mode === 'purchases' ? mode : 'purchases';
      const finalRows = rows.length ? rows : itemParties(ix, items, 'purchases');
      const total = finalRows.reduce((t, r) => t + r.amount, 0);
      const switched = finalMode !== mode;
      return {
        kind: 'itemParties', query: rest, items, mode: finalMode, rows: finalRows,
        title: finalMode === 'sales' ? `Who buys “${rest}”` : `Who supplies “${rest}”`,
        summary: finalRows.length
          ? `${switched ? `Nobody bought “${rest}” from you this year. ` : ''}${finalRows.length} ${finalMode === 'sales' ? (finalRows.length === 1 ? 'customer bought' : 'customers bought') : (finalRows.length === 1 ? 'supplier sold you' : 'suppliers sold you')} ${items.length > 1 ? `${items.length} matching items` : 'it'} — ${rupees(total)} in all. ${finalMode === 'sales' ? 'Top buyer' : 'Main supplier'}: ${parties[finalRows[0].party].name}.`
          : `“${rest}” appears in your item list but has no sales or purchases this year.`
      };
    }
  }

  const fallbackParty = partyAnswer();
  if (fallbackParty) return fallbackParty;

  if (range) {
    return periodAnswer(ix, range.from, range.to, range.label);
  }

  // Overall totals
  if (/\b(total|overall|summary|how is|how's|business|turnover|sales|purchases?)\b/.test(s)) {
    return periodAnswer(ix, ix.data.meta.firstDate, ix.data.meta.lastDate, `${day(ix.data.meta.firstDate)} – ${day(ix.data.meta.lastDate)}`);
  }

  return searchAll(ix, q);
}

export function searchAll(ix: TallyIndex, q: string): Answer {
  const parties = searchParties(ix, q, 20);
  const stock = searchStock(ix, q, 20);
  const nq = norm(q);
  const vouchers = nq.length >= 2
    ? ix.data.vouchers.map((v, i) => [v, i] as const).filter(([v]) => norm(v[2]) === nq || (nq.length >= 4 && norm(v[9]).includes(nq))).map(([, i]) => i).slice(0, 20)
    : [];
  const found = parties.length + stock.length + vouchers.length;
  return {
    kind: 'search', title: `Search: “${q}”`, parties, stock, vouchers,
    summary: found
      ? `Found ${[parties.length && `${parties.length} parties`, stock.length && `${stock.length} stock items`, vouchers.length && `${vouchers.length} entries`].filter(Boolean).join(', ')}.`
      : `Nothing matched “${q}”. Try part of a name (e.g. “akshay”), an item (e.g. “nano ps”), or a question like “who owes me”.`
  };
}

export function partySummary(ix: TallyIndex, i: number): string {
  const p = ix.data.parties[i];
  const a = ix.agg[i];
  const bal = balanceOf(p);
  const parts: string[] = [];
  parts.push(`${bal.side === 'settled' ? 'Their account is settled' : bal.words}${isBadDebt(p) ? ' (marked bad debt)' : ''}.`);
  if (a.salesAmt) {
    const top = itemsFor(ix, a.sales, 'sales')[0];
    parts.push(`They bought ${rupeesShort(a.salesAmt)} of goods from you in ${a.orders} order${a.orders === 1 ? '' : 's'}, last on ${day(a.lastSale)}.`);
    if (top) parts.push(`Most often: ${ix.data.items[top.item]}.`);
  } else if (a.purchAmt) {
    parts.push(`They didn't buy from you this year — you bought ${rupeesShort(a.purchAmt)} from them, last on ${day(a.lastPurchase)}${a.returnsAmt ? `, and returned goods worth ${rupeesShort(a.returnsAmt)} (GR)` : ''}.`);
  } else {
    parts.push('No goods bought or sold this year.');
  }
  return parts.join(' ');
}

/** Headline numbers for the home screen. */
export function overview(ix: TallyIndex) {
  let owedToYou = 0, youOwe = 0, badDebt = 0;
  ix.data.parties.forEach((p) => {
    const b = balanceOf(p);
    if (b.side === 'owes-you') { if (isBadDebt(p)) badDebt += b.amount; else owedToYou += b.amount; }
    if (b.side === 'you-owe') youOwe += b.amount;
  });
  const sales = ix.data.sales.reduce((t, l) => t + l[7], 0);
  const returns = ix.data.returns.reduce((t, l) => t + l[7], 0);
  const purchases = ix.data.purchases.reduce((t, l) => t + l[7], 0);
  const stockValue = ix.data.stock.reduce((t, s) => t + s[6], 0);
  return { owedToYou, youOwe, badDebt, sales, purchases, returns, stockValue };
}
