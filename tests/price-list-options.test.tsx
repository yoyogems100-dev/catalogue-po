import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePriceListOptions, printDate, priceListFileName, todayIso } from '../lib/price-list-options';

const shape = { rows: 2, columns: 3 };
const now = new Date('2026-10-17T20:30:00Z'); // already the 18th in India

test('blank name and date: no name, today in India', () => {
  const r = parsePriceListOptions({}, shape, now);
  assert.deepEqual(r, { ok: true, options: { customerName: null, date: '2026-10-18', prices: null } });
  assert.equal(todayIso(now), '2026-10-18');
});

test('name is tidied, date kept, prices parsed with blanks as "–"', () => {
  const r = parsePriceListOptions({ customer_name: '  Sharma   Jewellers ', date: '2026-11-01', prices: [[17, '19.5', ''], [null, 0, 961]] }, shape, now);
  assert.deepEqual(r, { ok: true, options: { customerName: 'Sharma Jewellers', date: '2026-11-01', prices: [[17, 19.5, null], [null, 0, 961]] } });
});

test('a stale or bad request fails instead of misplacing prices', () => {
  assert.equal(parsePriceListOptions({ prices: [[1, 2, 3]] }, shape, now).ok, false);           // wrong row count
  assert.equal(parsePriceListOptions({ prices: [[1, 2], [3, 4]] }, shape, now).ok, false);       // wrong column count
  assert.equal(parsePriceListOptions({ prices: [[1, -2, 3], [1, 2, 3]] }, shape, now).ok, false); // negative
  assert.equal(parsePriceListOptions({ prices: [[1, 'abc', 3], [1, 2, 3]] }, shape, now).ok, false);
  assert.equal(parsePriceListOptions({ date: '2026-02-30' }, shape, now).ok, false);
  assert.equal(parsePriceListOptions({ customer_name: 'x'.repeat(81) }, shape, now).ok, false);
  assert.equal(parsePriceListOptions({ prices: [[1, 2, 3], [1, 2, 3]] }, null, now).ok, false);
});

test('printed date and file name', () => {
  assert.equal(printDate('2026-10-17'), '17 Oct 2026');
  assert.equal(priceListFileName('YOYO-GEMS-Crushed-Ice-G-Series-Price-List', { customerName: 'Sharma & Sons, Rajkot', date: '2026-10-17' }),
    'YOYO-GEMS-Crushed-Ice-G-Series-Price-List-Sharma-Sons-Rajkot-2026-10-17.pdf');
  assert.equal(priceListFileName('List', { customerName: null, date: '2026-10-17' }), 'List-2026-10-17.pdf');
});
