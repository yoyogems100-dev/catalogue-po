import test from 'node:test';
import assert from 'node:assert/strict';
import { colourFamily, splitColourCode } from '../lib/colour-chart';

test('a supplier code is split from the colour name, other names stay whole', () => {
  assert.deepEqual(splitColourCode('G-42 M-Pink'), { code: 'G-42', label: 'M-Pink' });
  assert.deepEqual(splitColourCode('G-53 L-Fancy Purplish Pink'), { code: 'G-53', label: 'L-Fancy Purplish Pink' });
  assert.deepEqual(splitColourCode('Powder Rose 352'), { code: null, label: 'Powder Rose 352' });
});

test('the name decides the family where it says, the swatch otherwise', () => {
  assert.equal(colourFamily('#E8A6B0', 'G-46 Morganite Pink'), 'Pinks');
  assert.equal(colourFamily('#D4A017', 'G-13 D-Yellow'), 'Yellows');
  assert.equal(colourFamily('#9B4F8C', 'G-54 Rose Purple'), 'Purples');
  assert.equal(colourFamily('#C4599B', 'G-52 Fancy Purplish Pink'), 'Pinks');
  assert.equal(colourFamily('#00C2C7', 'G-27 Paraiba-A'), 'Aquas & teals');
  assert.equal(colourFamily('#F5F4F0', 'G-40 White D'), 'Whites');
  assert.equal(colourFamily('#1A3E8C', 'Mystery 7'), 'Blues');
  assert.equal(colourFamily(null, 'Mystery 8'), 'Greys & smoky');
});
