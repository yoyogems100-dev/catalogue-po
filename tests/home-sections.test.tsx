import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_REST_TITLE, layoutHomeSections, menuGroups, parseHomeSections, serializeHomeSections } from '../lib/home-sections';
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
    restShowsAll: false,
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

test('Most ordered saved as a shelf becomes a card tag; "More categories" reads as "All categories"', () => {
  const live = JSON.stringify({ restTitle: 'More categories', sections: [{ key: 'most-ordered', title: 'Most ordered', subtitle: '', cardLabel: 'Most ordered', visible: true, categoryIds: [1, 3] }] });
  const config = parseHomeSections(live);
  assert.equal(config.restTitle, 'All categories');
  assert.equal(config.sections[0].display, 'tag');
  assert.equal(config.sections[0].inMenu, false);
  const { shelves, rest, tags } = layoutHomeSections(config, [1, 2, 3].map((id) => ({ id })));
  assert.deepEqual(shelves, []);
  assert.deepEqual(rest.map((c) => c.id), [1, 2, 3]);
  assert.equal(tags.get(1), 'Most ordered');
  assert.equal(tags.has(2), false);
  // A title the owner chose is kept; choices round-trip.
  const back = parseHomeSections(serializeHomeSections({ ...config, restTitle: 'Everything', restShowsAll: false }));
  assert.equal(back.restTitle, 'Everything');
  assert.equal(back.restShowsAll, false);
  assert.equal(back.sections[0].display, 'tag');
});

test('"All categories" lists every category by default, shelves included', () => {
  const config = parseHomeSections(JSON.stringify({ sections: [{ key: 'w', title: 'White Round', visible: true, categoryIds: [2] }] }));
  const { shelves, rest } = layoutHomeSections(config, [1, 2, 3].map((id) => ({ id })));
  assert.deepEqual(shelves[0].categories.map((c) => c.id), [2]);
  assert.deepEqual(rest.map((c) => c.id), [1, 2, 3]);
});

test('menu: switched-on sections marked for the menu, with a picture', () => {
  const cats = [{ id: 1, icon: false }, { id: 2, icon: true }, { id: 3, icon: true }];
  const config = parseHomeSections(JSON.stringify({ sections: [
    { key: 'w', title: 'White Round', visible: true, categoryIds: [1, 2, 3] },
    { key: 'r', title: 'Ruby', visible: true, categoryIds: [3], iconCategoryId: 3 },
    { key: 'm', title: 'Most ordered', visible: true, display: 'tag', categoryIds: [1] },
    { key: 'off', title: 'Off', visible: false, categoryIds: [1] },
    { key: 'nomenu', title: 'Home only', visible: true, inMenu: false, categoryIds: [1] },
    { key: 'pick', title: 'Picked', visible: true, iconCategoryId: 3, categoryIds: [2, 3] },
    { key: 'gone', title: 'Empty', visible: true, categoryIds: [99] }
  ] }));
  const groups = menuGroups(config, cats, (c) => c.icon);
  assert.deepEqual(groups.map((g) => g.title), ['White Round', 'Ruby', 'Picked']);
  assert.equal(groups[0].icon?.id, 2, 'first category with a picture');
  assert.equal(groups[2].icon?.id, 3, 'the chosen picture');
});
