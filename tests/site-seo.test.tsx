import test from 'node:test';
import assert from 'node:assert/strict';
import { filterLinks, popularLinks, type FilterLink } from '../lib/site/seo';
import { shareImages } from '../lib/site/share';

const options = {
  shape: [{ slug: 'round', name: 'Round' }, { slug: 'oval', name: 'Oval' }],
  size: [],
  colour: [{ slug: 'royal-blue', name: 'Royal Blue' }],
  grade: [{ slug: '5a', name: '5A' }]
};
const photo = (shapes: string[], colours: string[], grade: string | null = null) => ({ shapes, colours, sizes: [], grade });

test('only filtered views with real photos are offered to search engines', () => {
  const page = { name: 'Nano', href: '/products/nano-spinel/nano', photos: [photo(['round'], ['royal-blue']), photo(['round'], []), photo([], [])] };
  assert.deepEqual(filterLinks(page, options, '{filters} {category}'), [
    { href: '/products/nano-spinel/nano?shape=round', label: 'Round Nano', photos: 2, category: '/products/nano-spinel/nano' },
    { href: '/products/nano-spinel/nano?colour=royal-blue', label: 'Royal Blue Nano', photos: 1, category: '/products/nano-spinel/nano' }
  ]); // no Oval and no 5A: nothing to show
  const allRound = { ...page, photos: [photo(['round'], [])] };
  assert.deepEqual(filterLinks({ ...page, name: 'Round Brilliants' }, options, '{filters} {category}').map((l) => l.label), ['Royal Blue Round Brilliants']);
  assert.deepEqual(filterLinks(allRound, options, '{filters} {category}'), []); // Round shows every photo: same as the page itself
});

test('popular searches are the best-photographed pages, spread across categories', () => {
  const l = (category: string, photos: number): FilterLink => ({ href: `${category}?n=${photos}`, label: `${category} ${photos}`, photos, category });
  const links = [l('/a', 50), l('/a', 40), l('/a', 30), l('/b', 5), l('/c', 20), l('/c', 1)];
  assert.deepEqual(popularLinks(links, 5).map((x) => x.label), ['/a 50', '/c 20', '/b 5', '/a 40', '/c 1']);
  assert.equal(popularLinks(links, 2).length, 2);
});

test('share images: owner photo, then a real stone photo, then the branded card', () => {
  assert.equal(shareImages(null, 'Moissanite', '/p.jpg')[0].url, '/p.jpg');
  assert.deepEqual(shareImages(null, 'Moissanite & Co'), [{ url: '/api/site/og?title=Moissanite%20%26%20Co', width: 1200, height: 630, alt: 'Moissanite & Co · YOYO GEMS' }]);
  assert.equal(shareImages(null, '')[0].url, '/api/site/og');
});
