import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { parseTallyWorkbook } from '../lib/tally/parse';
import { isGoodsReturn } from '../lib/tally/gr';
import { ask, balanceOf, buildIndex, dateRangeIn, itemsFor, voucherLabel } from '../lib/tally/query';
import { rupees, rupeesShort } from '../lib/tally/format';

// A tiny made-up workbook in the same shape as the Tally extract. Never use
// the owner's real Tally data in tests: this repository is public.
async function fixture() {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Summary').addRows([['Tally data extract'], ['Company: Test Gems | Extracted 01-Nov-2026']]);
  const parties = wb.addWorksheet('Parties');
  parties.addRow(['Party', 'Ledger Group', 'Role (FY26-27 activity)', 'State', 'Address', 'Opening Balance (₹)', 'Op Dr/Cr', 'Closing Balance (₹)', 'Cl Dr/Cr', 'Purchased (₹)', 'Sold (₹)', 'Paid - no stock (₹)', 'Received - no stock (₹)', '# Vouchers', 'Last Txn']);
  parties.addRow(['Ramesh Ji Jaipur', 'Sundry Debtors', 'Customer', 'Rajasthan', null, 1000, 'Dr', 5000, 'Dr', 0, 900, 0, 0, 3, '2026-10-05']);
  parties.addRow(['Lotus Supplier Co', 'Sundry Creditors', 'Supplier', null, null, 0, 'Cr', 2500, 'Cr', 4000, 0, 0, 0, 2, '2026-10-02']);
  parties.addRow(['Old Debt Bhai', 'Bad Debt', null, null, null, 700, 'Dr', 700, 'Dr', 0, 0, 0, 0, 0, null]);
  const lineHead = ['Date', 'Voucher No', 'Party', 'Item', 'Qty', 'Unit', 'Rate (₹)', 'Amount (₹)', 'Narration'];
  const sales = wb.addWorksheet('Sales');
  sales.addRow(lineHead);
  sales.addRow(['2026-09-01', '101', 'Ramesh Ji Jaipur', 'Ruby Oval 4*6', 100, 'Pcs', 3, 300]);
  sales.addRow(['2026-10-05', '102', 'Ramesh Ji Jaipur', 'Ruby Oval 4*6', 200, 'Pcs', 3, 600]);
  sales.addRow(['2026-10-06', '55(gr)', 'Lotus Supplier Co', 'Emerald Round 2.0', 10, 'Pcs', 50, 500]);
  const purchases = wb.addWorksheet('Purchases');
  purchases.addRow(lineHead);
  purchases.addRow(['2026-10-02', '55', 'Lotus Supplier Co', 'Emerald Round 2.0', 80, 'Pcs', 50, 4000]);
  const stock = wb.addWorksheet('Stock Items');
  stock.addRow(['Item', 'Group', 'Unit', 'Opening Qty', 'Opening Value (₹)', 'Opening Rate', 'Closing Qty', 'Closing Value (₹)', 'Closing Rate', 'Bought Qty', 'Bought Value (₹)', 'Avg Buy Rate', 'Last Buy Rate', 'Last Buy Date', 'Sold Qty', 'Sold Value (₹)', 'Avg Sell Rate', 'Last Sell Rate', 'Last Sell Date']);
  stock.addRow(['Ruby Oval 4*6', 'Ruby', 'Pcs', 500, 1000, 2, 200, 400, 2, 0, 0, null, null, null, 300, 900, 3, 3, '2026-10-05']);
  stock.addRow(['Emerald Round 2.0', 'Emerald', 'Pcs', 0, 0, 0, 70, 3500, 50, 80, 4000, 50, 50, '2026-10-02', 10, 500, 50, 50, '2026-10-06']);
  const vouchers = wb.addWorksheet('Vouchers');
  vouchers.addRow(['Date', 'Type', 'Voucher No', 'Party', 'Party Group', 'Amount (₹)', 'Stock Lines', 'Stock Value (₹)', 'Other Ledgers', 'Narration']);
  vouchers.addRow(['2026-09-01', 'Receipt', '101', 'Ramesh Ji Jaipur', 'Sundry Debtors', 300, 1, 300, 'Cash 300']);
  vouchers.addRow(['2026-10-05', 'Receipt', '102', 'Ramesh Ji Jaipur', 'Sundry Debtors', 600, 1, 600, 'Cash 600']);
  vouchers.addRow(['2026-10-02', 'Payment', '55', 'Lotus Supplier Co', 'Sundry Creditors', 4000, 1, 4000, 'Cash 4000']);
  vouchers.addRow(['2026-10-06', 'Receipt', '55(gr)', 'Lotus Supplier Co', 'Sundry Creditors', 500, 1, 500, 'Cash 500']);
  vouchers.addRow(['2026-10-20', 'Receipt', null, 'Ramesh Ji Jaipur', 'Sundry Debtors', 2000, 0, 0, 'Cash 2000']);
  const ledgers = wb.addWorksheet('All Ledgers');
  ledgers.addRow(['Ledger', 'Group', 'State', 'Address', 'Opening (₹)', 'Op Dr/Cr', 'Closing (₹)', 'Cl Dr/Cr']);
  ledgers.addRow(['Test Bank Current', 'Bank Accounts', null, null, 0, 'Dr', 12345, 'Dr']);
  const buf = await wb.xlsx.writeBuffer();
  return parseTallyWorkbook(buf as ArrayBuffer, 'test.xlsx');
}

test('parses the extract and keeps GR goods returns apart from sales', async () => {
  const data = await fixture();
  assert.equal(data.meta.company, 'Test Gems');
  assert.equal(data.parties.length, 3);
  assert.equal(data.sales.length, 2);
  assert.equal(data.returns.length, 1);
  assert.equal(data.purchases.length, 1);
  assert.equal(data.ledgers.length, 1);
  assert.equal(data.meta.firstDate, '2026-09-01');
  assert.equal(data.meta.lastDate, '2026-10-20');
});

test('GR voucher numbers are recognised', () => {
  for (const v of ['8576(gr)', 'GR', 'gr(-5042 CASH)', '8174(GR)', 'gr']) assert.equal(isGoodsReturn(v), true, v);
  for (const v of ['8576', 'GRN-1', 'grade', '15501', '']) assert.equal(isGoodsReturn(v), false, v);
  assert.equal(voucherLabel('Receipt', 1, '55(gr)'), 'Goods return (GR)');
  assert.equal(voucherLabel('Receipt', 1, '101'), 'Sale (goods out)');
  assert.equal(voucherLabel('Receipt', 0, ''), 'Money received');
  assert.equal(voucherLabel('Payment', 2, '55'), 'Purchase (goods in)');
});

test('balances read as plain words', () => {
  assert.equal(balanceOf({ closing: 5000, closingType: 'Dr' }).words, 'They owe you ₹5,000');
  assert.equal(balanceOf({ closing: 2500, closingType: 'Cr' }).side, 'you-owe');
  assert.equal(balanceOf({ closing: 0.4, closingType: 'Dr' }).side, 'settled');
  assert.equal(rupees(1234567), '₹12,34,567');
  assert.equal(rupeesShort(53274486), '₹5.33 Cr');
  assert.equal(rupeesShort(2194136), '₹21.9 L');
});

test('answers everyday questions', async () => {
  const ix = buildIndex(await fixture());

  const owes = ask(ix, 'who owes me money?');
  assert.equal(owes.kind, 'parties');
  if (owes.kind === 'parties') assert.deepEqual(owes.rows.map((r) => ix.data.parties[r.party].name), ['Ramesh Ji Jaipur']); // bad debt left out

  const owe = ask(ix, 'who do I owe');
  if (owe.kind === 'parties') assert.equal(ix.data.parties[owe.rows[0].party].name, 'Lotus Supplier Co');

  const who = ask(ix, 'what does ramesh usually buy');
  assert.equal(who.kind, 'party');
  const typo = ask(ix, 'ramsh jaipur');
  assert.equal(typo.kind === 'party' && ix.data.parties[typo.party].name, 'Ramesh Ji Jaipur');

  const buyers = ask(ix, 'who buys ruby oval');
  assert.equal(buyers.kind, 'itemParties');
  if (buyers.kind === 'itemParties') { assert.equal(buyers.mode, 'sales'); assert.equal(buyers.rows[0].amount, 900); }

  const suppliers = ask(ix, 'who supplies emerald');
  if (suppliers.kind === 'itemParties') assert.equal(suppliers.mode, 'purchases');

  const st = ask(ix, 'stock of ruby');
  assert.equal(st.kind, 'stock');

  const gr = ask(ix, 'goods returns');
  if (gr.kind === 'parties') assert.equal(gr.rows[0].value, 500);

  const oct = ask(ix, 'sales in october');
  assert.equal(oct.kind, 'period');
  if (oct.kind === 'period') { assert.equal(oct.sales, 600); assert.equal(oct.returns, 500); assert.equal(oct.received, 2000); }

  assert.equal(ask(ix, 'bank').kind, 'ledgers');
  assert.equal(ask(ix, 'zzzz qqq').kind, 'search');
});

test('what a customer buys: times, quantity and last rate', async () => {
  const ix = buildIndex(await fixture());
  const r = ix.data.parties.findIndex((p) => p.name === 'Ramesh Ji Jaipur');
  const [top] = itemsFor(ix, ix.agg[r].sales, 'sales');
  assert.equal(ix.data.items[top.item], 'Ruby Oval 4*6');
  assert.equal(top.times, 2);
  assert.equal(top.qty.get('Pcs'), 300);
  assert.equal(top.last, '2026-10-05');
  assert.equal(ix.agg[r].orders, 2);
});

test('dates in questions', () => {
  assert.deepEqual(dateRangeIn('sales last month', '2026-11-24'), { from: '2026-10-01', to: '2026-10-31', label: 'Oct 2026' });
  assert.equal(dateRangeIn('in december', '2026-11-24')?.from, '2025-12-01'); // most recent December, not a future one
  assert.equal(dateRangeIn('last 7 days', '2026-11-24')?.from, '2026-11-18');
  assert.equal(dateRangeIn('who owes me', '2026-11-24'), null);
});
