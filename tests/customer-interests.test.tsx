import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeInterestIds, withInterests, MAX_INTERESTS } from '../lib/customer-interests';
import { layoutHomeSections, mostOrderedSection } from '../lib/home-sections';

const shop = { sections: [mostOrderedSection([2, 3])], restTitle: 'More categories' };
const cats = [1, 2, 3, 4, 5].map((id) => ({ id }));

test('interest ids keep pick order, drop junk and duplicates, and are capped', () => {
  assert.deepEqual(sanitizeInterestIds([5, '2', 5, -1, 0, 'x', 2.5, null]), [5, 2]);
  assert.deepEqual(sanitizeInterestIds('5,2'), []);
  assert.equal(sanitizeInterestIds(Array.from({ length: 40 }, (_, i) => i + 1)).length, MAX_INTERESTS);
});

test('a buyer with picks gets "Curated for you" first, in their order', () => {
  const { shelves, rest } = layoutHomeSections(withInterests(shop, { ids: [4, 1, 99], show: true }), cats);
  assert.equal(shelves[0].title, 'Curated for you');
  assert.deepEqual(shelves[0].categories.map((c) => c.id), [4, 1], 'a missing or archived category drops out');
  assert.deepEqual(shelves[1].categories.map((c) => c.id), [2, 3], 'the shop shelves still follow');
  assert.deepEqual(rest.map((c) => c.id), [5]);
});

test('no shelf when hidden, empty, or not signed in', () => {
  assert.equal(withInterests(shop, { ids: [4], show: false }), shop);
  assert.equal(withInterests(shop, { ids: [], show: true }), shop);
  assert.equal(withInterests(shop, null), shop);
});

test('the admin picker lists the picks in order with the shelf switch', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: CustomerInterestsField } = await import('../components/admin/CustomerInterestsField');
  const categories = [{ id: 1, name: 'Moissanite', slug: 'moissanite' }, { id: 2, name: 'Glass Pearls', slug: 'glass-pearls' }];
  const html = renderToStaticMarkup(<CustomerInterestsField categories={categories} ids={[2, 1, 7]} show onChange={() => {}} />);
  assert.ok(html.indexOf('Glass Pearls') < html.indexOf('Moissanite</span>'), 'chips follow pick order');
  assert.match(html, /Curated for you/);
  assert.match(html, /type="checkbox" checked=""/);
  assert.doesNotMatch(renderToStaticMarkup(<CustomerInterestsField categories={categories} ids={[]} show={false} onChange={() => {}} />), /interests-chips/);
});
