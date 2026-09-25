import test from 'node:test';
import assert from 'node:assert/strict';
import { colorFamilyId, COLOR_FAMILIES } from '../lib/color-family';
import { DEFAULT_MOST_ORDERED, parseMostOrdered, serializeMostOrdered } from '../lib/most-ordered';

const family = (name: string, hex?: string) => COLOR_FAMILIES.find((f) => f.id === colorFamilyId(name, hex))?.name;

test('colour families follow the name before the stored swatch', () => {
  assert.equal(family('#204 London Blue', '#998848'), 'Blue'); // swatch is olive, name says blue
  assert.equal(family('G-05 Morganite Orange'), 'Orange & Peach');
  assert.equal(family('G-51 Purple Garnet'), 'Purple');
  assert.equal(family('Rose Gold'), 'Pink');
  assert.equal(family('Colorless / White'), 'White');
  assert.equal(family('Ruby Red'), 'Red');
  assert.equal(family('G-63 Color Change 2#'), 'Colour change');
  assert.equal(family('Emerald Green'), 'Green');
});

test('code-only colour names fall back to the swatch', () => {
  assert.equal(family('112#', '#131564'), 'Blue');
  assert.equal(family('104#', '#6D7177'), 'Grey & Silver');
  assert.equal(family('999#', null), undefined);
});

test('most ordered list: default until saved, then the saved order', () => {
  assert.deepEqual(parseMostOrdered(undefined), DEFAULT_MOST_ORDERED);
  assert.deepEqual(parseMostOrdered('2, 1,2,x,-3'), [2, 1]);
  assert.deepEqual(parseMostOrdered(''), []); // owner cleared it on purpose
  assert.equal(serializeMostOrdered([3, 3, 1]), '3,1');
});
