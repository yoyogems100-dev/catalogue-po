import test from 'node:test';
import assert from 'node:assert/strict';
import { lineQualities, parseCategoryQualities, parseShapeQualities, pickQualities } from '../lib/qualities';

const NANO = 3, OSP_HW = 901, OSP_FLAT = 900;
const category = parseCategoryQualities(null); // Nano has no category list
const shapes = parseShapeQualities(JSON.stringify({ [NANO]: { [OSP_HW]: ['3A', 'AA'], 5: [] }, x: { 1: ['A'] } }));

test('Green OSP HW offers 3A / AA, starting on 3A; other Nano cuts have no Quality field', () => {
  assert.deepEqual(pickQualities(category, shapes, NANO, [OSP_HW]), { grades: ['3A', 'AA'], start: '3A' });
  assert.deepEqual(pickQualities(category, shapes, NANO, [OSP_FLAT]), { grades: [], start: '' });
  assert.deepEqual(pickQualities(category, shapes, NANO, []), { grades: [], start: '' });
  // Picked together, only the HW line carries the quality.
  assert.deepEqual(pickQualities(category, shapes, NANO, [OSP_FLAT, OSP_HW]).grades, ['3A', 'AA']);
  assert.deepEqual(lineQualities(category, shapes, NANO, OSP_HW), ['3A', 'AA']);
  assert.deepEqual(lineQualities(category, shapes, NANO, OSP_FLAT), []);
});

test("a shape's list replaces the category's; junk entries are dropped", () => {
  assert.deepEqual(lineQualities(category, shapes, 2, 1), ['5A', '7A']); // Ruby Corundum's built-in list
  assert.deepEqual(Object.keys(shapes), [String(NANO)]);
  assert.deepEqual(Object.keys(shapes[NANO]), [String(OSP_HW)]);
});
