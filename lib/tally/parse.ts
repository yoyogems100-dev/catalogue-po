import ExcelJS from 'exceljs';
import { isGoodsReturn } from './gr';
import type { DrCr, TallyData, TallyLedger, TallyLine, TallyParty, TallyStock, TallyVoucher } from './types';

// Reads the "YOYO GEMS - Tally data extract" workbook (sheets Summary, Parties,
// Purchases, Sales, Stock Items, Vouchers, All Ledgers). Columns are found by
// their header text, so a re-export with columns in a different order still
// loads. A sheet that is missing simply loads as empty, except Parties, which
// the portal can't work without.

type Row = Record<string, unknown>;

function key(v: unknown) {
  return String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9#]+/g, ' ').trim();
}

function cellValue(v: unknown): unknown {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('result' in o) return cellValue(o.result); // formula
    if ('richText' in o && Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join('');
    if ('text' in o) return o.text; // hyperlink
    return null;
  }
  return v;
}

function readSheet(wb: ExcelJS.Workbook, name: string): Row[] {
  const ws = wb.worksheets.find((s) => key(s.name) === key(name));
  if (!ws) return [];
  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => { headers[col] = key(cellValue(cell.value)); });
  const rows: Row[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const rec: Row = {};
    let any = false;
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const h = headers[col];
      if (!h) return;
      const v = cellValue(cell.value);
      if (v !== null && v !== '') { rec[h] = v; any = true; }
    });
    if (any) rows.push(rec);
  });
  return rows;
}

const str = (v: unknown) => (v == null ? '' : String(v).trim());
const num = (v: unknown) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(String(v ?? '').replace(/[,₹\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const drcr = (v: unknown): DrCr => {
  const s = str(v).toLowerCase();
  return s === 'dr' ? 'Dr' : s === 'cr' ? 'Cr' : '';
};
/** Accepts 2026-04-01, 01-04-2026, 01/04/2026 or an Excel date; returns YYYY-MM-DD or ''. */
export function normalDate(v: unknown): string {
  const s = str(v);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}
// Pick the first header that exists among several spellings.
const pick = (r: Row, ...names: string[]) => {
  for (const n of names) { const v = r[key(n)]; if (v !== undefined) return v; }
  return undefined;
};

export async function parseTallyWorkbook(buffer: ArrayBuffer, fileName = 'tally.xlsx'): Promise<TallyData> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const partyRows = readSheet(wb, 'Parties');
  if (!partyRows.length) throw new Error('This file has no "Parties" sheet. Upload the Tally data extract workbook.');

  const parties: TallyParty[] = [];
  const partyIndex = new Map<string, number>();
  const addParty = (p: TallyParty) => {
    const k = p.name.toLowerCase();
    const existing = partyIndex.get(k);
    if (existing !== undefined) return existing;
    partyIndex.set(k, parties.length);
    parties.push(p);
    return parties.length - 1;
  };
  const blankParty = (name: string, group = ''): TallyParty => ({
    name, group, role: '', state: '', address: '', opening: 0, openingType: '', closing: 0, closingType: '',
    purchased: 0, sold: 0, paidNoStock: 0, receivedNoStock: 0, vouchers: 0, lastTxn: ''
  });
  for (const r of partyRows) {
    const name = str(pick(r, 'Party', 'Name', 'Ledger'));
    if (!name) continue;
    addParty({
      name,
      group: str(pick(r, 'Ledger Group', 'Group')),
      role: str(pick(r, 'Role (FY26-27 activity)', 'Role')),
      state: str(pick(r, 'State')),
      address: str(pick(r, 'Address')),
      opening: num(pick(r, 'Opening Balance (₹)', 'Opening Balance', 'Opening (₹)')),
      openingType: drcr(pick(r, 'Op Dr/Cr')),
      closing: num(pick(r, 'Closing Balance (₹)', 'Closing Balance', 'Closing (₹)')),
      closingType: drcr(pick(r, 'Cl Dr/Cr')),
      purchased: num(pick(r, 'Purchased (₹)', 'Purchased')),
      sold: num(pick(r, 'Sold (₹)', 'Sold')),
      paidNoStock: num(pick(r, 'Paid - no stock (₹)', 'Paid no stock (₹)')),
      receivedNoStock: num(pick(r, 'Received - no stock (₹)', 'Received no stock (₹)')),
      vouchers: num(pick(r, '# Vouchers', 'Vouchers')),
      lastTxn: normalDate(pick(r, 'Last Txn', 'Last Transaction'))
    });
  }
  const partyOf = (name: string, group = '') => {
    const i = partyIndex.get(name.toLowerCase());
    return i !== undefined ? i : addParty(blankParty(name, group));
  };

  const items: string[] = [];
  const itemIndex = new Map<string, number>();
  const itemOf = (name: string) => {
    const k = name.toLowerCase();
    let i = itemIndex.get(k);
    if (i === undefined) { i = items.length; items.push(name); itemIndex.set(k, i); }
    return i;
  };

  const lines = (sheet: string): TallyLine[] => readSheet(wb, sheet).flatMap((r): TallyLine[] => {
    const party = str(pick(r, 'Party'));
    const item = str(pick(r, 'Item', 'Stock Item'));
    if (!party || !item) return [];
    return [[
      normalDate(pick(r, 'Date')), str(pick(r, 'Voucher No', 'Vch No')), partyOf(party), itemOf(item),
      num(pick(r, 'Qty', 'Quantity')), str(pick(r, 'Unit')), num(pick(r, 'Rate (₹)', 'Rate')),
      num(pick(r, 'Amount (₹)', 'Amount')), str(pick(r, 'Narration'))
    ]];
  });
  // A goods-out voucher numbered "8576(gr)", "GR" or "gr(...)" is a goods
  // return against a purchase bill, not a sale — keep it apart so "what does
  // this customer buy" isn't inflated by returns.
  const goodsOut = lines('Sales');
  const sales = goodsOut.filter((l) => !isGoodsReturn(l[1]));
  const returns = goodsOut.filter((l) => isGoodsReturn(l[1]));
  const purchases = lines('Purchases');

  const vouchers: TallyVoucher[] = readSheet(wb, 'Vouchers').flatMap((r): TallyVoucher[] => {
    const party = str(pick(r, 'Party'));
    if (!party) return [];
    const group = str(pick(r, 'Party Group'));
    return [[
      normalDate(pick(r, 'Date')), str(pick(r, 'Type', 'Voucher Type')), str(pick(r, 'Voucher No')), partyOf(party, group), group,
      num(pick(r, 'Amount (₹)', 'Amount')), num(pick(r, 'Stock Lines')), num(pick(r, 'Stock Value (₹)', 'Stock Value')),
      str(pick(r, 'Other Ledgers')), str(pick(r, 'Narration'))
    ]];
  });

  const stock: TallyStock[] = readSheet(wb, 'Stock Items').flatMap((r): TallyStock[] => {
    const name = str(pick(r, 'Item', 'Name'));
    if (!name) return [];
    return [[
      name, str(pick(r, 'Group')), str(pick(r, 'Unit')),
      num(pick(r, 'Opening Qty')), num(pick(r, 'Opening Value (₹)', 'Opening Value')),
      num(pick(r, 'Closing Qty')), num(pick(r, 'Closing Value (₹)', 'Closing Value')),
      num(pick(r, 'Bought Qty')), num(pick(r, 'Bought Value (₹)', 'Bought Value')),
      num(pick(r, 'Last Buy Rate')), normalDate(pick(r, 'Last Buy Date')),
      num(pick(r, 'Sold Qty')), num(pick(r, 'Sold Value (₹)', 'Sold Value')),
      num(pick(r, 'Last Sell Rate')), normalDate(pick(r, 'Last Sell Date'))
    ]];
  });

  const ledgers: TallyLedger[] = readSheet(wb, 'All Ledgers').flatMap((r): TallyLedger[] => {
    const name = str(pick(r, 'Ledger', 'Name'));
    if (!name || partyIndex.has(name.toLowerCase())) return [];
    return [[name, str(pick(r, 'Group')), str(pick(r, 'State')), num(pick(r, 'Closing (₹)', 'Closing')), drcr(pick(r, 'Cl Dr/Cr'))]];
  });

  // The Summary sheet's first lines say which company and period this is.
  const summary = wb.worksheets.find((s) => key(s.name) === 'summary');
  const note = summary ? str(cellValue(summary.getRow(2).getCell(1).value)) : '';
  const company = note.match(/Company:\s*([^|]+)/i)?.[1]?.trim() || 'Yoyo Gems';

  const dates = [...sales, ...purchases].map((l) => l[0]).concat(vouchers.map((v) => v[0])).filter(Boolean).sort();
  return {
    version: 1,
    meta: { company, note, fileName, uploadedAt: new Date().toISOString(), firstDate: dates[0] || '', lastDate: dates[dates.length - 1] || '' },
    parties, items, sales, purchases, returns, vouchers, stock, ledgers
  };
}
