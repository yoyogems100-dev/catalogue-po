import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCount, parseCount } from '../lib/site/count';

test('figures count up with their + and commas kept', () => {
  const c = parseCount('9,000+')!;
  assert.deepEqual(c, { prefix: '', target: 9000, decimals: 0, grouped: true, suffix: '+' });
  assert.equal(formatCount(c, 0), '0+');
  assert.equal(formatCount(c, 4500.4), '4,500+');
  assert.equal(formatCount(parseCount('1,00,000')!, 100000), '1,00,000');
  assert.equal(formatCount(parseCount('₹2.5 Cr')!, 1.25), '₹1.3 Cr');
  assert.equal(formatCount(parseCount('40+')!, 40), '40+');
  assert.equal(parseCount('Since forever'), null);
});
