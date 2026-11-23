import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  cleanLastOrder, hasUsual, lastOrderFrom, panelOrder, splitUsual, usualCategoriesFirst, usualCategoryIds, usualDropdownIds, usualFromCustomer,
  usualInCategory, usualSizeIds, usualSizeIndexes, EMPTY_USUAL
} from '../lib/usual-picks';
import { sizeGroupsOf } from '../lib/faceted-picker';

// A regular buyer as the team saves them on the admin customer page: two
// go-to categories, and usual picks for Red (Ruby 5A, Round 3 mm, #12) and
// Pink (Ruby again, Oval 6x8) plus White in another stone.
const buyer = usualFromCustomer({
  interest_category_ids: [37, 2],
  order_preferences: [
    { familyId: 4, categoryId: 2, grade: '5A', colorId: 12, shapeId: 1, size: '3' },
    { familyId: 5, categoryId: 2, colorId: 14, shapeId: 5, size: '6*8' },
    { familyId: 1, categoryId: 28, colorId: 3 }
  ]
});

test('reads both saved columns off a customer row, tolerating junk', () => {
  assert.deepEqual(buyer.categoryIds, [37, 2]);
  assert.equal(buyer.preferences.length, 3);
  assert.deepEqual(usualFromCustomer(null), EMPTY_USUAL);
  const junk = usualFromCustomer({ interest_category_ids: 'x', order_preferences: { nope: 1 } });
  assert.equal(hasUsual(junk), false);
  assert.equal(hasUsual(buyer), true);
});

test('go-to categories come first in the team order, then stones the usual picks open', () => {
  assert.deepEqual(usualCategoryIds(buyer), [37, 2, 28]);
  assert.deepEqual(usualCategoryIds(EMPTY_USUAL), []);
});

test('inside a stone, only that stone\'s picks count; sizes compare by meaning', () => {
  assert.deepEqual(usualInCategory(buyer, 2), { shapeIds: [1, 5], colorIds: [12, 14], sizeKeys: ['3', '6x8'] });
  assert.deepEqual(usualInCategory(buyer, 28), { shapeIds: [], colorIds: [3], sizeKeys: [] });
  assert.deepEqual(usualInCategory(buyer, 99), { shapeIds: [], colorIds: [], sizeKeys: [] });
  assert.deepEqual(usualInCategory(buyer, null), { shapeIds: [], colorIds: [], sizeKeys: [] });

  const rows = [
    { id: 10, shapeId: 1, sizeMm: '2' }, { id: 11, shapeId: 1, sizeMm: '3.0' }, { id: 12, shapeId: 5, sizeMm: '6x8 mm' }, { id: 13, shapeId: 5, sizeMm: '7x9' }
  ];
  const groups = sizeGroupsOf(rows);
  assert.deepEqual(usualSizeIndexes(groups, ['3', '6x8']).map((i) => groups[i].sizeMm), ['3.0', '6x8 mm']);
  assert.deepEqual(usualSizeIds(rows, ['3', '6x8']), [11, 12]);
  assert.deepEqual(usualDropdownIds(buyer, 2, groups).sizeIdxs, usualSizeIndexes(groups, ['3', '6x8']));
});

test('usual options split out first and everything else keeps its order', () => {
  const opts = [1, 2, 3, 4, 5].map((id) => ({ id }));
  assert.deepEqual(splitUsual(opts, [4, 2]).map((part) => part.map((o) => o.id)), [[2, 4], [], [1, 3, 5]]);
  assert.deepEqual(splitUsual(opts, [5]).map((part) => part.map((o) => o.id)), [[5], [], [1, 2, 3, 4]]);
  assert.deepEqual(splitUsual(opts, [5], [1, 5]).map((part) => part.map((o) => o.id)), [[5], [1], [2, 3, 4]], 'saved wins over last order');
  assert.deepEqual(splitUsual(opts, undefined)[0], []);
});

test('an open dropdown: usual first, then hot-selling, then selected -- unchanged without picks', () => {
  const opts = [1, 2, 3, 4, 5, 6].map((id) => ({ id }));
  const hot = (o: { id: number }) => o.id === 5 || o.id === 3;
  const selected = new Set([6]);
  const before = panelOrder(opts, { selected, hot }).map((o) => o.id);
  assert.deepEqual(before, [3, 5, 6, 1, 2, 4], 'today\'s order: hot, then selected');
  assert.deepEqual(panelOrder(opts, { selected, hot, usualIds: [] }).map((o) => o.id), before);
  assert.deepEqual(panelOrder(opts, { selected, hot, usualIds: [4, 5] }).map((o) => o.id), [5, 4, 3, 6, 1, 2]);
  // Options that don't go with the other picks still sink below those that do.
  assert.deepEqual(panelOrder(opts, { selected, hot, usualIds: [4, 5], fitIds: [1, 2, 3, 5] }).map((o) => o.id), [5, 3, 1, 2, 4, 6]);
});

test('stone search hits in a go-to category come first, otherwise untouched', () => {
  const hits = [{ categoryId: 3, n: 'a' }, { categoryId: 37, n: 'b' }, { categoryId: 5, n: 'c' }, { categoryId: 37, n: 'd' }];
  assert.deepEqual(usualCategoriesFirst(hits, [37]).map((h) => h.n), ['b', 'd', 'a', 'c']);
  assert.equal(usualCategoriesFirst(hits, []), hits);
});

test('the admin native selects group usual options under "Their usual"', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: UsualOptions } = await import('../components/admin/UsualOptions');
  const opts = [{ id: 1, name: 'Round' }, { id: 2, name: 'Oval' }, { id: 3, name: 'Pear' }];
  const render = (o: { id: number; name: string }) => <option key={o.id} value={o.id}>{o.name}</option>;
  const html = renderToStaticMarkup(<select>{<UsualOptions options={opts} usualIds={[3]} render={render} />}</select>);
  assert.match(html, /<optgroup label="Their usual"><option value="3">Pear<\/option><\/optgroup><optgroup label="All"><option value="1">Round/);
  const plain = renderToStaticMarkup(<select>{<UsualOptions options={opts} usualIds={[]} render={render} />}</select>);
  assert.doesNotMatch(plain, /optgroup/);
});

test('every order form passes the buyer\'s usual ids to its dropdowns', () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const po = read('components/POSelector.tsx');
  for (const prop of ['colorIds', 'shapeIds', 'sizeIdxs']) {
    assert.ok(po.includes(`usualIds={usual.${prop}}`), `POSelector: ${prop}`);
    assert.ok(po.includes(`recentIds={usual.recent.${prop}}`), `POSelector last order: ${prop}`);
  }
  for (const field of ['color', 'shape', 'size']) assert.ok(po.includes(`clearOnOpen={swapNext.${field}}`), `POSelector clears ${field} on open`);
  const builder = read('app/admin/orders/new/AdminOrderBuilder.tsx');
  for (const prop of ['categoryIds', 'shapeIds', 'colorIds', 'sizeIdxs']) {
    assert.ok(builder.includes(`usualIds={usual.${prop}}`), `builder: ${prop}`);
    assert.ok(builder.includes(`recentIds={usual.recent.${prop}}`), `builder last order: ${prop}`);
  }
  for (const field of ['shape', 'color', 'size']) assert.ok(builder.includes(`clearOnOpen={clearNext.${field}}`), `builder clears ${field} on open`);
  assert.match(read('app/admin/orders/[id]/OrderAdminClient.tsx'), /<UsualOptions options=\{opts\.shapes\}/);
  assert.match(read('app/api/order-preferences/route.ts'), /myCategoryIds/);
});

// Owner, 2026-11-23: "based on the past order automatically show ... first the
// items the last that they placed".
test('last order: stones of the newest order; per stone, lines of the newest order that had it', () => {
  const orders = [
    { id: 1, created_at: '2026-10-01T00:00:00Z' },
    { id: 2, created_at: '2026-11-01T00:00:00Z' },
    { id: 3, created_at: '2026-11-20T00:00:00Z' },
    { id: 4, created_at: '2026-11-22T00:00:00Z' } // no lines: skipped
  ];
  const items = [
    { order_id: 1, category_id: 2, shape_id: 9, color_id: 99, size_mm: '9' },
    { order_id: 1, category_id: 28, shape_id: 7, color_id: 70, size_mm: '7x9' },
    { order_id: 2, category_id: 2, shape_id: 1, color_id: 12, size_mm: '3.0' },
    { order_id: 2, category_id: 2, shape_id: 5, color_id: 12, size_mm: '6*8' },
    { order_id: 3, category_id: 37, shape_id: 1, color_id: 3, size_mm: '2' },
    { order_id: 3, category_id: null, shape_id: 1, color_id: null, size_mm: null }
  ];
  const last = lastOrderFrom(orders, items);
  assert.deepEqual(last.categoryIds, [37], 'the stones of the newest order with lines');
  assert.deepEqual(last.picks.find((p) => p.categoryId === 2), { categoryId: 2, shapeIds: [1, 5], colorIds: [12], sizeKeys: ['3', '6x8'] }, 'order 1 does not add to Ruby');
  assert.deepEqual(last.picks.find((p) => p.categoryId === 28)?.sizeKeys, ['7x9'], 'an older order still counts for a stone not ordered since');
  assert.deepEqual(lastOrderFrom([], []), { categoryIds: [], picks: [] });
});

test('saved picks lead, then the last order, then the existing order', () => {
  const source = { ...buyer, lastOrder: lastOrderFrom([{ id: 1, created_at: '2026-11-01' }], [
    { order_id: 1, category_id: 2, shape_id: 8, color_id: 14, size_mm: '7x9' },
    { order_id: 1, category_id: 5, shape_id: 1, color_id: 1, size_mm: '1' }
  ]) };
  const groups = sizeGroupsOf([{ id: 10, shapeId: 1, sizeMm: '3' }, { id: 11, shapeId: 1, sizeMm: '5' }, { id: 12, shapeId: 5, sizeMm: '7x9' }]);
  const ids = usualDropdownIds(source, 2, groups);
  assert.deepEqual(ids.recent, { categoryIds: [2, 5], colorIds: [14], shapeIds: [8], sizeIdxs: [2] });
  const opts = [1, 2, 5, 8, 9].map((id) => ({ id }));
  assert.deepEqual(panelOrder(opts, { selected: new Set(), hot: () => false, usualIds: ids.shapeIds, recentIds: ids.recent.shapeIds }).map((o) => o.id), [1, 5, 8, 2, 9]);
  // A buyer with no saved picks still gets their last order first.
  const onlyLast = usualDropdownIds({ ...EMPTY_USUAL, lastOrder: source.lastOrder }, 2, groups);
  assert.deepEqual(onlyLast.shapeIds, []);
  assert.deepEqual(panelOrder(opts, { selected: new Set(), hot: () => false, usualIds: onlyLast.shapeIds, recentIds: onlyLast.recent.shapeIds }).map((o) => o.id), [8, 1, 2, 5, 9]);
  assert.equal(hasUsual({ ...EMPTY_USUAL, lastOrder: source.lastOrder }), true);
});

test('a last order from the wire is cleaned', () => {
  assert.deepEqual(cleanLastOrder(null), { categoryIds: [], picks: [] });
  assert.deepEqual(cleanLastOrder({ categoryIds: [3, 'x', -1], picks: [{ categoryId: 3, shapeIds: [1, 'a'], colorIds: [], sizeKeys: ['3', 4] }, { categoryId: 'no' }] }),
    { categoryIds: [3], picks: [{ categoryId: 3, shapeIds: [1], colorIds: [], sizeKeys: ['3'] }] });
});

test('native selects: "Their usual", then "Their last order", then "All"', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: UsualOptions } = await import('../components/admin/UsualOptions');
  const opts = [{ id: 1, name: 'Round' }, { id: 2, name: 'Oval' }, { id: 3, name: 'Pear' }];
  const render = (o: { id: number; name: string }) => <option key={o.id} value={o.id}>{o.name}</option>;
  const html = renderToStaticMarkup(<select>{<UsualOptions options={opts} usualIds={[]} recentIds={[2]} render={render} />}</select>);
  assert.match(html, /^<select><optgroup label="Their last order"><option value="2">Oval<\/option><\/optgroup><optgroup label="All">/);
});

test('the dropdown clears itself only on the click that opens it', () => {
  const src = readFileSync(new URL('../components/IconSelect.tsx', import.meta.url), 'utf8');
  assert.match(src, /const clearing = justOpened && isMulti && !!multi\.clearOnOpen && multi\.values\.length > 0;/);
  assert.match(src, /if \(clearing\) multi\.onChange\(\[\]\);/);
});
