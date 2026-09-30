import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRupees } from '../lib/money';

test('one rupee format: Indian grouping, paise only when present', () => {
  assert.equal(formatRupees(14.3), '14.30');
  assert.equal(formatRupees(14), '14');
  assert.equal(formatRupees(397799.6), '3,97,799.60');
  assert.equal(formatRupees(1025), '1,025');
});

test('line amounts add up to the total shown', () => {
  const lines = [13.2 * 7, 24.2 * 7];
  assert.equal(lines.map(formatRupees).join(' + '), '92.40 + 169.40');
  assert.equal(formatRupees(lines[0] + lines[1]), '261.80');
});
