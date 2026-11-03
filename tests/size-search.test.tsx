import test from 'node:test';
import assert from 'node:assert/strict';
import { sizeSearchScore } from '../lib/size-options';

const find = (q: string, labels: string[]) =>
  labels.map((l, i) => ({ l, i, s: sizeSearchScore(q, l) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.l);
const LIST = ['1.5 mm', '4.0 mm', '4x6 mm', '5.0 mm', '5.5 mm', '5x5 mm', '5x7 mm', '15.0 mm', '5.9 mm'];

test('the same size, however it is typed, comes first', () => {
  for (const q of ['5mm', '5 mm', '5', '5.0', '5.00', '5MM']) assert.deepEqual(find(q, LIST).slice(0, 2), ['5.0 mm', '5x5 mm'], q);
  for (const q of ['5x5', '5/5', '5*5', '5 X 5', '5×5']) assert.deepEqual(find(q, LIST).slice(0, 2), ['5.0 mm', '5x5 mm'], q);
  assert.equal(find('5.900', LIST)[0], '5.9 mm');
  assert.equal(find('4/6', LIST)[0], '4x6 mm');
});

test('a start of a size still suggests it; unrelated sizes are left out', () => {
  assert.ok(find('5', LIST).includes('5x7 mm') && find('5', LIST).includes('5.5 mm'));
  assert.ok(!find('5', LIST).includes('1.5 mm') && !find('5', LIST).includes('15.0 mm'));
  assert.deepEqual(find('4x', LIST), ['4x6 mm']);
  assert.deepEqual(find('9', LIST), []);
});

test('a size written the other way round finds the same size', () => {
  for (const q of ['7x5', '7*5', '7/5', '7 X 5 mm']) assert.equal(find(q, LIST)[0], '5x7 mm', q);
  assert.equal(find('6x4', LIST)[0], '4x6 mm');
  assert.ok(find('7x', LIST).includes('5x7 mm'));
  assert.ok(!find('7x', LIST).includes('4x6 mm'));
});

test('3x4 finds 4x3 however either is written (owner, 2026-11-03)', () => {
  const list = ['3.0 mm', '3x4 mm', '4x3 mm', '3x5 mm', '4x6 mm'];
  for (const q of ['3x4', '4x3', '3*4', '4*3', '3 X 4', '4×3', '3/4', '3x4mm']) {
    const hits = find(q, list);
    assert.ok(hits.slice(0, 2).includes('3x4 mm') && hits.slice(0, 2).includes('4x3 mm'), q);
  }
  assert.ok(!find('3x4', list).includes('4x6 mm'));
});
