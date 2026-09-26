import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { pickCategoryImages, type Row } from '../lib/site/category-images';
import { categoryDefaults } from '../lib/site/category-defaults';

const row = (id: number, slug: string, parent_id: number | null = null, extra: Partial<Row> = {}): Row =>
  ({ id, parent_id, slug, name: slug.toUpperCase(), hero_media_id: null, published: null, ...extra });

test('a category uses the clean /po cut-out of its first catalogue source that has one', () => {
  const rows = [row(1, 'cz'), row(2, 'white-cz', 1)];
  const slugs = new Map([[99, 'no-icon-here'], [36, '4a-quality-cz'], [35, '3a-quality-cz']]);
  const out = pickCategoryImages(rows, [{ site_category_id: 2, category_id: 99 }, { site_category_id: 2, category_id: 36 }, { site_category_id: 2, category_id: 35 }], slugs, new Map([[99, 'https://x/99.jpg']]), new Map());
  assert.equal(out[2].src, '/reference/categories/hd2/4a-quality-cz.webp');
  assert.equal(out[2].cutout, true);
  assert.equal(out[2].alt, 'WHITE-CZ stones');
});

test('with no cut-out, the catalogue photo is used', () => {
  const out = pickCategoryImages([row(5, 'x')], [{ site_category_id: 5, category_id: 99 }], new Map([[99, 'no-icon-here']]), new Map([[99, 'https://x/99.jpg']]), new Map());
  assert.equal(out[5].src, 'https://x/99.jpg');
  assert.ok(!out[5].cutout);
});

test('every /po dropdown icon has a high-resolution copy for the website', () => {
  for (const f of readdirSync('public/reference/categories').filter((n) => n.endsWith('.png'))) {
    assert.ok(existsSync(`public/reference/categories/hd2/${f.replace('.png', '.webp')}`), f);
  }
});

test('a main category with no picture of its own borrows its first sub-category’s', () => {
  const rows = [row(1, 'cz'), row(2, 'white-cz', 1), row(3, 'coloured-cz', 1)];
  const out = pickCategoryImages(rows, [{ site_category_id: 3, category_id: 12 }], new Map(), new Map([[12, 'https://x/12.jpg']]), new Map());
  assert.equal(out[1].src, 'https://x/12.jpg');
  assert.equal(out[1].alt, 'CZ stones');
  assert.equal(out[2], undefined);
});

test('an image chosen in admin wins over the catalogue photo', () => {
  const rows = [row(1, 'moissanite', null, { hero_media_id: 7 })];
  const media = new Map([[7, { id: 7, storage_path: 'site/m.webp', variants: null, width: 960, height: 640, alt: 'Moissanite' } as any]]);
  const out = pickCategoryImages(rows, [{ site_category_id: 1, category_id: 34 }], new Map([[34, 'moissanite']]), new Map([[34, 'https://x/34.jpg']]), media);
  assert.ok(!out[1].src.includes('/reference/'));
  assert.equal(out[1].alt, 'Moissanite');
});

test('starting copy exists for every main category and never promises trade terms', () => {
  for (const slug of ['cz', 'nano-spinel', 'ruby-corundum', 'lab-grown', 'polki', 'glass-crystal', 'beads-pearls', 'special-categories', 'natural', 'moissanite']) {
    const c = categoryDefaults(null, slug) as any;
    assert.ok(c.what?.body, `${slug} has "what it is"`);
    assert.ok(!c.stock?.moq && !c.stock?.lead_time, `${slug} leaves MOQ and lead time to the owner`);
  }
  assert.ok((categoryDefaults('cz', 'white-cz') as any).range.body.includes('7A'));
});
