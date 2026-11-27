import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePhotos, cleanDate, discussionFromBody, parseDiscussionPlaces, sanitizeItems, sanitizePlaces } from '../lib/discussions';

test('the place list starts with the four offices/channels and never stores "Other"', () => {
  assert.deepEqual(parseDiscussionPlaces(null), ['Jaipur office', 'Surat office', 'Phone', 'Exhibition']);
  assert.deepEqual(parseDiscussionPlaces('not json'), ['Jaipur office', 'Surat office', 'Phone', 'Exhibition']);
  assert.deepEqual(sanitizePlaces([' Mumbai  office ', 'mumbai office', 'Other', '', 'Phone']), ['Mumbai office', 'Phone']);
  assert.deepEqual(parseDiscussionPlaces('["Phone","IIJS Exhibition"]'), ['Phone', 'IIJS Exhibition']);
});

test('discussed items keep category rows and drop blank ones', () => {
  assert.deepEqual(sanitizeItems([
    { category_id: 7, label: 'Roshan G Max Maxwell Stone', details: 'CZ G White, Canary Yellow, Light Pink' },
    { category_id: null, label: '', details: '' },
    { category_id: 'x', label: 'Anything', details: 'Follow up on fancy colours' },
    'junk',
  ]), [
    { category_id: 7, label: 'Roshan G Max Maxwell Stone', details: 'CZ G White, Canary Yellow, Light Pink', photos: [] },
    { category_id: null, label: 'Anything', details: 'Follow up on fancy colours', photos: [] },
  ]);
});

test('a save needs a real date and something discussed', () => {
  assert.equal(cleanDate('2026-02-30'), null);
  assert.equal(cleanDate('2026-11-27'), '2026-11-27');
  assert.deepEqual(discussionFromBody({ heldOn: '2026-11-27', items: [], notes: ' ' }, 5), { error: 'Add at least one discussed item or a note.' });
  assert.deepEqual(discussionFromBody({ heldOn: 'today', notes: 'x' }, 5), { error: 'Pick the date it was held.' });
  const ok = discussionFromBody({ heldOn: '2026-11-27', place: ' Surat office ', items: [{ category_id: 3, label: 'Fusion Stones', details: 'CBX 5208 TCF' }], notes: '' }, 5);
  assert.deepEqual(ok, { values: { held_on: '2026-11-27', place: 'Surat office', items: [{ category_id: 3, label: 'Fusion Stones', details: 'CBX 5208 TCF', photos: [] }], notes: null } });
});

test('the buyer card shows date, place, each category with what was discussed, notes and last update', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: DiscussionCard } = await import('../components/DiscussionCard');
  const html = renderToStaticMarkup(<DiscussionCard discussion={{
    id: 1, customer_id: 2, held_on: '2026-11-20', place: 'Jaipur office',
    items: [{ category_id: 7, label: 'Roshan G Max Maxwell Stone', details: 'CZ G White, Canary Yellow, Light Pink', photos: [PHOTO] },
      { category_id: 9, label: 'Fusion Stones', details: 'CBX 5208 TCF, Colour Fancy', photos: [] }],
    notes: 'Samples to follow', created_at: '2026-11-20T06:00:00Z', updated_at: '2026-11-22T06:00:00Z',
  }} />);
  assert.equal((html.match(/discussion-photo-thumb/g) || []).length, 1, 'one thumbnail, on the item it belongs to');
  assert.ok(html.includes(`/storage/v1/object/public/photos/${PHOTO}`));
  for (const text of ['20 Nov 2026', 'Jaipur office', 'Roshan G Max Maxwell Stone', 'Canary Yellow', 'Fusion Stones', 'CBX 5208 TCF', 'Samples to follow', 'Last updated'])
    assert.ok(html.includes(text), text);
});

const PHOTO = 'discussions/5/0f8fad5b-d9cb-469f-a165-70867728950e.webp';

test('item photos: only this buyer\'s uploaded discussion photos are kept, once each', () => {
  const other = 'discussions/6/0f8fad5b-d9cb-469f-a165-70867728950e.webp';
  assert.deepEqual(sanitizePhotos([PHOTO, PHOTO, other, 'https://evil.example/x.jpg', '../secret', 3], 5), [PHOTO]);
  assert.deepEqual(sanitizePhotos([PHOTO, other]), [PHOTO, other], 'reads keep any buyer path');
  const saved = discussionFromBody({ heldOn: '2026-11-27', items: [{ category_id: null, label: '', details: '', photos: [PHOTO] }] }, 5);
  assert.deepEqual(saved, { values: { held_on: '2026-11-27', place: null, items: [{ category_id: null, label: 'General', details: '', photos: [PHOTO] }], notes: null } }, 'a photo alone is enough for an item');
});
