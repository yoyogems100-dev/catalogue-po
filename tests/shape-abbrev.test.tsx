import test from 'node:test';
import assert from 'node:assert/strict';
import { shapeAbbrev, shapeAbbrevs } from '../lib/shape-abbrev';

test('shape short names: admin code, trade short form, then from the name', () => {
  assert.equal(shapeAbbrev('Heart', 'HS'), 'HS');
  assert.equal(shapeAbbrev('Round'), 'RD');
  assert.equal(shapeAbbrev('Round Checker'), 'RC');
  assert.equal(shapeAbbrev('Oval Cabochon (Pota)'), 'OC');
  assert.equal(shapeAbbrev('Lily'), 'LIL');
  // Two shapes that would share a short name keep their full names.
  const m = shapeAbbrevs([{ id: 1, name: 'Oval Checker' }, { id: 2, name: 'Oval Cabochon (Pota)' }, { id: 3, name: 'Pear' }]);
  assert.deepEqual([m.get(1), m.get(2), m.get(3)], ['Oval Checker', 'Oval Cabochon (Pota)', 'PS']);
});
