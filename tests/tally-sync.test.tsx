import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fromTally, isRawSync, type RawSync } from '../lib/tally/from-tally';
import { buildIndex, ask } from '../lib/tally/query';
// The sync program is plain JavaScript that runs on the Tally computer.
import * as sync from '../scripts/tally-sync/tally-sync.mjs';

// Made-up data only — this repository is public.
const VOUCHERS_XML = `<ENVELOPE><BODY><DESC><CMPINFO><VOUCHER>1</VOUCHER></CMPINFO></DESC><DATA><COLLECTION>
<VOUCHER REMOTEID="g1" VCHTYPE="Payment"><DATE TYPE="Date">20261002</DATE><GUID>g1</GUID><NARRATION TYPE="String">lot &amp; box</NARRATION>
 <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME><PARTYLEDGERNAME TYPE="String">Lotus Supplier Co</PARTYLEDGERNAME><VOUCHERNUMBER>55</VOUCHERNUMBER><ALTERID> 101</ALTERID>
 <ALLINVENTORYENTRIES.LIST><STOCKITEMNAME TYPE="String">Emerald Round 2.0</STOCKITEMNAME><ISDEEMEDPOSITIVE TYPE="Logical">Yes</ISDEEMEDPOSITIVE><RATE TYPE="Rate">50.0000/Pcs</RATE><AMOUNT TYPE="Amount">-4000.0000</AMOUNT><ACTUALQTY TYPE="Quantity"> 80.0000 Pcs</ACTUALQTY>
  <BATCHALLOCATIONS.LIST><AMOUNT TYPE="Amount">-1.0000</AMOUNT><ACTUALQTY TYPE="Quantity"> 1 Pcs</ACTUALQTY></BATCHALLOCATIONS.LIST>
  <ACCOUNTINGALLOCATIONS.LIST><LEDGERNAME TYPE="String">Purchase</LEDGERNAME><AMOUNT TYPE="Amount">-4000.0000</AMOUNT></ACCOUNTINGALLOCATIONS.LIST></ALLINVENTORYENTRIES.LIST>
 <ALLINVENTORYENTRIES.LIST><STOCKITEMNAME TYPE="String">Round Off</STOCKITEMNAME><ISDEEMEDPOSITIVE TYPE="Logical">Yes</ISDEEMEDPOSITIVE><RATE TYPE="Rate"></RATE><AMOUNT TYPE="Amount">-2.0000</AMOUNT><ACTUALQTY TYPE="Quantity"></ACTUALQTY></ALLINVENTORYENTRIES.LIST>
 <ALLLEDGERENTRIES.LIST><LEDGERNAME TYPE="String">Cash</LEDGERNAME><AMOUNT TYPE="Amount">4002.0000</AMOUNT></ALLLEDGERENTRIES.LIST>
</VOUCHER>
<VOUCHER REMOTEID="g2" VCHTYPE="Receipt"><DATE TYPE="Date">20261005</DATE><GUID>g2</GUID><VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME><PARTYLEDGERNAME TYPE="String">Ramesh Ji Jaipur</PARTYLEDGERNAME><VOUCHERNUMBER>102</VOUCHERNUMBER><ALTERID> 102</ALTERID>
 <ALLINVENTORYENTRIES.LIST><STOCKITEMNAME TYPE="String">Emerald Round 2.0</STOCKITEMNAME><ISDEEMEDPOSITIVE TYPE="Logical">No</ISDEEMEDPOSITIVE><RATE TYPE="Rate">70.0000/Pcs</RATE><AMOUNT TYPE="Amount">1400.0000</AMOUNT><ACTUALQTY TYPE="Quantity"> 20.0000 Pcs</ACTUALQTY></ALLINVENTORYENTRIES.LIST>
 <ALLLEDGERENTRIES.LIST><LEDGERNAME TYPE="String">Cash</LEDGERNAME><AMOUNT TYPE="Amount">-1400.0000</AMOUNT></ALLLEDGERENTRIES.LIST>
</VOUCHER>
<VOUCHER REMOTEID="g3" VCHTYPE="Receipt"><DATE TYPE="Date">20261006</DATE><GUID>g3</GUID><VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME><PARTYLEDGERNAME TYPE="String">Lotus Supplier Co</PARTYLEDGERNAME><VOUCHERNUMBER>55(gr)</VOUCHERNUMBER><ALTERID> 103</ALTERID>
 <ALLINVENTORYENTRIES.LIST><STOCKITEMNAME TYPE="String">Emerald Round 2.0</STOCKITEMNAME><ISDEEMEDPOSITIVE TYPE="Logical">No</ISDEEMEDPOSITIVE><RATE TYPE="Rate">50.0000/Pcs</RATE><AMOUNT TYPE="Amount">500.0000</AMOUNT><ACTUALQTY TYPE="Quantity"> 10.0000 Pcs</ACTUALQTY></ALLINVENTORYENTRIES.LIST>
</VOUCHER>
<VOUCHER REMOTEID="g4" VCHTYPE="Receipt"><DATE TYPE="Date">20261020</DATE><GUID>g4</GUID><VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME><PARTYLEDGERNAME TYPE="String">Ramesh Ji Jaipur</PARTYLEDGERNAME><VOUCHERNUMBER></VOUCHERNUMBER><ALTERID> 104</ALTERID>
 <ALLLEDGERENTRIES.LIST><LEDGERNAME TYPE="String">Ramesh Ji Jaipur</LEDGERNAME><AMOUNT TYPE="Amount">2000.0000</AMOUNT><BILLALLOCATIONS.LIST><AMOUNT TYPE="Amount">9.0000</AMOUNT></BILLALLOCATIONS.LIST></ALLLEDGERENTRIES.LIST>
 <ALLLEDGERENTRIES.LIST><LEDGERNAME TYPE="String">Cash</LEDGERNAME><AMOUNT TYPE="Amount">-2000.0000</AMOUNT></ALLLEDGERENTRIES.LIST>
</VOUCHER></COLLECTION></DATA></BODY></ENVELOPE>`;

const LEDGERS_XML = `<ENVELOPE><DATA><COLLECTION>
<LEDGER NAME="Ramesh Ji Jaipur"><PARENT TYPE="String">Sundry Debtors</PARENT><LEDSTATENAME TYPE="String">Rajasthan</LEDSTATENAME><CLOSINGBALANCE TYPE="Amount">-5000.0000</CLOSINGBALANCE><OPENINGBALANCE TYPE="Amount">-1000.0000</OPENINGBALANCE></LEDGER>
<LEDGER NAME="Lotus Supplier Co"><ADDRESS.LIST TYPE="String"><ADDRESS TYPE="String">B76 Gem City</ADDRESS></ADDRESS.LIST><PARENT TYPE="String">China Sundry Creditors</PARENT><CLOSINGBALANCE TYPE="Amount">2500.0000</CLOSINGBALANCE><OPENINGBALANCE TYPE="Amount"></OPENINGBALANCE></LEDGER>
<LEDGER NAME="Cash"><PARENT TYPE="String">Cash-in-hand</PARENT><CLOSINGBALANCE TYPE="Amount">99999.0000</CLOSINGBALANCE><OPENINGBALANCE TYPE="Amount">0</OPENINGBALANCE></LEDGER>
</COLLECTION></DATA></ENVELOPE>`;

const GROUPS_XML = `<ENVELOPE><DATA><COLLECTION>
<GROUP NAME="China Sundry Creditors"><PARENT TYPE="String">Sundry Creditors</PARENT></GROUP>
<GROUP NAME="Sundry Creditors"><PARENT TYPE="String">Current Liabilities</PARENT></GROUP>
<GROUP NAME="Sundry Debtors"><PARENT TYPE="String">Current Assets</PARENT></GROUP>
<GROUP NAME="Cash-in-hand"><PARENT TYPE="String">Current Assets</PARENT></GROUP>
<GROUP NAME="Current Assets"><PARENT TYPE="String">&#4; Primary</PARENT></GROUP>
</COLLECTION></DATA></ENVELOPE>`;

const STOCK_XML = `<ENVELOPE><DATA><COLLECTION>
<STOCKITEM NAME="Emerald Round 2.0"><PARENT TYPE="String">Emerald</PARENT><BASEUNITS TYPE="String">Pcs</BASEUNITS><OPENINGBALANCE TYPE="Quantity"> 20.0000 Pcs</OPENINGBALANCE><OPENINGVALUE TYPE="Amount">-800.0000</OPENINGVALUE></STOCKITEM>
</COLLECTION></DATA></ENVELOPE>`;

function raw(): RawSync {
  return {
    format: 'yoyo-tally-raw-1', company: 'Test Gems', computer: 'TEST-PC', syncedAt: '2026-10-21T10:00:00.000Z', fromDate: '20260401', toDate: '20270331',
    groups: sync.parseGroups(GROUPS_XML), ledgers: sync.parseLedgers(LEDGERS_XML), stock: sync.parseStock(STOCK_XML),
    vouchers: sync.parseVouchers(VOUCHERS_XML).map((x: { v: unknown }) => x.v)
  } as RawSync;
}

test('the sync program reads Tally XML: entries, item lines, ledger lines, masters', () => {
  const v = sync.parseVouchers(VOUCHERS_XML);
  assert.equal(v.length, 4, 'the <VOUCHER>1</VOUCHER> count in CMPINFO is not an entry');
  const [g1] = v;
  assert.equal(g1.alter, 101);
  assert.deepEqual(g1.v.slice(0, 6), ['g1', '20261002', 'Payment', '55', 'Lotus Supplier Co', 'lot & box']);
  assert.deepEqual(g1.v[6][0], ['Emerald Round 2.0', 80, 'Pcs', 50, 4000, true], 'entry-level amount/qty, not the batch line');
  assert.deepEqual(v[3].v[7][0], ['Ramesh Ji Jaipur', 2000], 'bill allocations are not read as the ledger amount');
  assert.deepEqual(sync.parseLedgers(LEDGERS_XML)[1], ['Lotus Supplier Co', 'China Sundry Creditors', '', 'B76 Gem City', 0, 2500]);
  assert.deepEqual(sync.parseGroups(GROUPS_XML)[4], ['Current Assets', 'Primary']);
  assert.deepEqual(sync.parseStock(STOCK_XML)[0], ['Emerald Round 2.0', 'Emerald', 'Pcs', 20, 800]);
});

test('the program only ever sends export requests to Tally', () => {
  const src = readFileSync(path.join(process.cwd(), 'scripts/tally-sync/tally-sync.mjs'), 'utf8');
  assert.match(src, /Refusing to send a non-export request to Tally/);
  assert.ok(!/ClosingValue|ClosingBalance,ClosingValue/.test(src.replace(/No ClosingValue/g, '')), 'never asks Tally to calculate closing stock');
  assert.ok(!/TALLYREQUEST>Import/i.test(src));
});

test('Tally data becomes portal data: balances, sales, purchases, GR returns, stock', () => {
  const r = raw();
  assert.ok(isRawSync(r));
  const d = fromTally(r);
  const names = d.parties.map((p) => p.name);
  assert.deepEqual(names.sort(), ['Lotus Supplier Co', 'Ramesh Ji Jaipur'], 'Cash is not a party');
  const ramesh = d.parties.find((p) => p.name === 'Ramesh Ji Jaipur')!;
  assert.equal(ramesh.closing, 5000); assert.equal(ramesh.closingType, 'Dr');
  assert.equal(ramesh.openingType, 'Dr');
  assert.equal(ramesh.receivedNoStock, 2000);
  assert.equal(d.parties.find((p) => p.name === 'Lotus Supplier Co')!.closingType, 'Cr');
  assert.equal(d.purchases.length, 1, 'Round Off has no quantity and is not an item line');
  assert.equal(d.sales.length, 1);
  assert.equal(d.returns.length, 1);
  assert.equal(d.vouchers.length, 4);
  assert.deepEqual(d.ledgers.find((l) => l[0] === 'Cash'), ['Cash', 'Cash-in-hand', '', 99999, 'Cr']);
  // Stock: 20 opening + 80 in − 20 sold − 10 returned = 70, valued at average cost (800 + 4000) / 100 = 48.
  const em = d.stock[0];
  assert.equal(em[5], 70);
  assert.equal(em[6], 3360);
  assert.equal(em[10], '2026-10-02');
  assert.equal(em[14], '2026-10-06');
  assert.equal(d.meta.lastDate, '2026-10-20');
});

test('the portal answers questions on live-synced data', () => {
  const ix = buildIndex(fromTally(raw()));
  const a = ask(ix, 'who owes me');
  assert.equal(a.kind === 'parties' && ix.data.parties[a.rows[0].party].name, 'Ramesh Ji Jaipur');
  const b = ask(ix, 'who do I owe');
  assert.equal(b.kind === 'parties' && b.rows.length, 1, 'Cash’s balance is not "you owe"');
  assert.equal(ask(ix, 'bank and cash').kind, 'ledgers');
});
