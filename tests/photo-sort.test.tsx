import test from 'node:test';
import assert from 'node:assert/strict';
import { sortPhotoGroups } from '../lib/photo-sort';

const g = (id: number, uploadedAt: string | null) => ({ lead: { id, uploadedAt } });
const groups = [g(5, '2026-09-01T10:00:00Z'), g(2, '2026-09-20T10:00:00Z'), g(9, '2026-09-01T10:00:00Z'), g(7, null)];
const ids = (list: { lead: { id: number } }[]) => list.map((x) => x.lead.id);

test('featured keeps the admin order', () => {
  assert.deepEqual(ids(sortPhotoGroups(groups, 'featured')), [5, 2, 9, 7]);
});

test('recently uploaded first; same upload time falls back to the later photo id', () => {
  assert.deepEqual(ids(sortPhotoGroups(groups, 'newest')), [2, 9, 5, 7]);
});

test('oldest first is the exact reverse, and the input is not mutated', () => {
  assert.deepEqual(ids(sortPhotoGroups(groups, 'oldest')), [7, 5, 9, 2]);
  assert.deepEqual(ids(groups), [5, 2, 9, 7]);
});
