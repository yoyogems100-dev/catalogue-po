import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_REST_TITLE, layoutHomeSections, parseHomeSections, serializeHomeSections } from '../lib/home-sections';
import { DEFAULT_MOST_ORDERED } from '../lib/most-ordered';

test('before the new setup is saved, the old Most ordered list is the only shelf', () => {
  const fromDefault = parseHomeSections(null, null);
  assert.equal(fromDefault.sections.length, 1);
  assert.equal(fromDefault.sections[0].title, 'Most ordered');
  assert.deepEqual(fromDefault.sections[0].categoryIds, DEFAULT_MOST_ORDERED);
  assert.equal(fromDefault.restTitle, DEFAULT_REST_TITLE);
  assert.deepEqual(parseHomeSections(undefined, '5,2').sections[0].categoryIds, [5, 2]);
  assert.deepEqual(parseHomeSections(null, '').sections, []); // owner had cleared the list
  assert.deepEqual(parseHomeSections('not json', '4').sections[0].categoryIds, [4]);
});

test('saved sections round-trip cleanly, dropping junk', () => {
  const saved = serializeHomeSections({
    restTitle: '  ',
    sections: [
      { key: 'a', title: ' New in ', subtitle: '', cardLabel: 'New', visible: true, categoryIds: [3, 3, 7, -1] },
      { key: 'a', title: '', subtitle: 'x', cardLabel: '', visible: false, categoryIds: [] }
    ]
  });
  const back = parseHomeSections(saved, '1,2');
  assert.equal(back.restTitle, DEFAULT_REST_TITLE);
  assert.equal(back.sections[0].title, 'New in');
  assert.deepEqual(back.sections[0].categoryIds, [3, 7]);
  assert.equal(back.sections[1].title, 'Untitled section');
  assert.equal(back.sections[1].visible, false);
  assert.notEqual(back.sections[0].key, back.sections[1].key);
  // An empty saved setup stays empty rather than falling back to the old list.
  assert.deepEqual(parseHomeSections(serializeHomeSections({ sections: [], restTitle: 'All' }), '1,2').sections, []);
});

test('layout: visible shelves in order, missing categories drop out, the rest follow', () => {
  const cats = [1, 2, 3, 4, 5].map((id) => ({ id }));
  const { shelves, rest } = layoutHomeSections({
    restTitle: 'More',
    sections: [
      { key: 'n', title: 'New in', subtitle: '', cardLabel: 'New', visible: true, categoryIds: [4, 99, 1] },
      { key: 'h', title: 'Hidden', subtitle: '', cardLabel: '', visible: false, categoryIds: [2] },
      { key: 'm', title: 'Most ordered', subtitle: '', cardLabel: '', visible: true, categoryIds: [1, 3] },
      { key: 'e', title: 'Empty', subtitle: '', cardLabel: '', visible: true, categoryIds: [99] }
    ]
  }, cats);
  assert.deepEqual(shelves.map((s) => s.title), ['New in', 'Most ordered']);
  assert.deepEqual(shelves[0].categories.map((c) => c.id), [4, 1]);
  assert.deepEqual(shelves[1].categories.map((c) => c.id), [1, 3]); // a category can sit on two shelves
  assert.deepEqual(rest.map((c) => c.id), [2, 5]); // on a hidden shelf only, so it stays in the rest
});
