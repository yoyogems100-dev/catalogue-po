import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeInterestIds, toggleInterest, withInterests, MAX_INTERESTS } from '../lib/customer-interests';
import { layoutHomeSections, mostOrderedSection } from '../lib/home-sections';

const shop = { sections: [{ ...mostOrderedSection([2, 3]), display: 'shelf' as const }], restTitle: 'More categories', restShowsAll: false };
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

test('a star adds to the end of the shelf, un-star removes, a full shelf refuses', () => {
  assert.deepEqual(toggleInterest([4, 1], 7, true), [4, 1, 7]);
  assert.deepEqual(toggleInterest([4, 1], 4, true), [4, 1], 'already starred keeps its place');
  assert.deepEqual(toggleInterest([4, 1], 4, false), [1]);
  assert.deepEqual(toggleInterest([4, 1], 9, false), [4, 1]);
  const full = Array.from({ length: MAX_INTERESTS }, (_, i) => i + 1);
  assert.equal(toggleInterest(full, 99, true), null);
  assert.deepEqual(toggleInterest(full, 1, false), full.slice(1));
});

test('home cards carry a star: a toggle when signed in, a sign-in link for guests', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: HomeCatalogue } = await import('../app/po/HomeCatalogue');
  const cat = (id: number, name: string) => ({ id, num: id, name, slug: name.toLowerCase(), thumb: null, shapeIds: [], colorIds: [], shapeCount: 0, colorCount: 0, sizeCount: 0, badgeTypes: [] as ('shapes' | 'colors' | 'sizes')[] });
  const categories = [cat(1, 'Ruby'), cat(2, 'Emerald')];
  const props = { categories, allShapes: [], allColors: [], sections: { sections: [], restTitle: 'More categories' }, colorButtonIds: [] };
  const signedIn = renderToStaticMarkup(<HomeCatalogue {...props} signedIn interests={{ ids: [2], show: true }} />);
  assert.match(signedIn, /Curated for you/);
  assert.match(signedIn, /aria-pressed="true" aria-label="Remove Emerald from Curated for you"/);
  assert.match(signedIn, /aria-pressed="false" aria-label="Add Ruby to Curated for you"/);
  const guest = renderToStaticMarkup(<HomeCatalogue {...props} />);
  assert.doesNotMatch(guest, /Curated for you<\/h2>/);
  assert.match(guest, /href="\/po\/account\/login\?next=\/po"/);
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
