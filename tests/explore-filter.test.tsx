import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NO_FILTER, matchesFilter, parseExploreFilter, reconcileFilter, toStoredFilter } from '../lib/explore-filter';

const sizes = [
  { id: 1, shape_id: 10, size_mm: '4x6' },
  { id: 2, shape_id: 11, size_mm: '4 x 6 mm' },
  { id: 3, shape_id: 10, size_mm: '5x7' }
];
const photo = { shapeIds: [10], sizeIds: [1], colorIds: [7], tagIds: [] as number[] };

test('a saved default round-trips and junk is ignored', () => {
  const f = { shapeId: 10, sizeKey: '4x6', colorId: null, tagId: null };
  assert.deepEqual(parseExploreFilter(toStoredFilter(f)), f);
  assert.equal(toStoredFilter(NO_FILTER), null);
  assert.deepEqual(parseExploreFilter({ shape_id: 'x', color_id: -2 }), NO_FILTER);
  assert.deepEqual(parseExploreFilter([1]), NO_FILTER);
});

test('size matches by displayed mm across shapes, like the Explore dropdown', () => {
  assert.ok(matchesFilter(photo, { ...NO_FILTER, sizeKey: '4x6' }, sizes));
  assert.ok(matchesFilter({ ...photo, shapeIds: [11], sizeIds: [2] }, { ...NO_FILTER, sizeKey: '4x6' }, sizes));
  assert.ok(!matchesFilter(photo, { ...NO_FILTER, sizeKey: '5x7' }, sizes));
  assert.ok(!matchesFilter(photo, { ...NO_FILTER, colorId: 8 }, sizes));
  assert.ok(matchesFilter(photo, { shapeId: 10, sizeKey: '4x6', colorId: 7, tagId: null }, sizes));
});

test('parts of a default the category no longer offers are dropped', () => {
  const f = reconcileFilter({ shapeId: 99, sizeKey: '5x7', colorId: 7, tagId: 4 }, { shapeIds: [10, 11], colorIds: [7], tagIds: [], sizes });
  assert.deepEqual(f, { shapeId: null, sizeKey: '5x7', colorId: 7, tagId: null });
  assert.equal(reconcileFilter({ ...NO_FILTER, shapeId: 11, sizeKey: '5x7' }, { shapeIds: [11], colorIds: [], tagIds: [], sizes }).sizeKey, null);
});
