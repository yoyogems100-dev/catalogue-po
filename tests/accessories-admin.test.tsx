import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
// @ts-ignore -- plain .mjs helper shared with scripts/accessories-index.mjs
import { extractAccessories } from '../lib/accessories/extract.mjs';
import { ACCESSORIES, effectiveCatalogue, orderedRanges, parseOverrides, serializeOverrides, emptyOverrides } from '../lib/accessories/overrides';

const html = fs.readFileSync(path.join(__dirname, '../public/po/accessories/index.html'), 'utf8');

test('the admin list matches the Accessories page (run npm run accessories:index after changing the page)', () => {
  const fresh = JSON.parse(JSON.stringify(extractAccessories(html)));
  assert.deepEqual(fresh, JSON.parse(JSON.stringify(ACCESSORIES)));
  assert.equal(new Set(fresh.styles.map((s: any) => s.sku)).size, fresh.styles.length, 'style IDs are unique');
  const ids = new Set(fresh.ranges.map((r: any) => r.id));
  assert.equal(ids.size, fresh.ranges.length, 'range IDs are unique (a range pasted twice shows twice on the page)');
  assert.ok(fresh.styles.every((s: any) => ids.has(s.cat)), 'every style belongs to a range');
});

test('saved edits keep only clean, known fields', () => {
  const o = parseOverrides(JSON.stringify({
    page: { title: ' New <b>title</b> ', whatsapp: '+91 90799 14601', junk: 1 },
    order: ['y4', 'y4', 'bad id!', 7],
    ranges: { braided: { hidden: true, name: '  Silk   bands ', extra: 'x' }, 'no good': { hidden: true } },
    styles: { 'Y54-01': { out: true, code: 'ABC', hidden: 'yes' }, 'Y54-02': {} }
  }));
  assert.equal(o.page.title, 'New btitle/b');
  assert.equal(o.page.whatsapp, '919079914601');
  assert.deepEqual(o.order, ['y4']);
  assert.deepEqual(o.ranges, { braided: { hidden: true, name: 'Silk bands' } });
  assert.deepEqual(o.styles, { 'Y54-01': { out: true, code: 'ABC' } });
  assert.deepEqual(parseOverrides('not json'), emptyOverrides());
});

test('edits that repeat the original are dropped, so put-back means no edit', () => {
  const s = ACCESSORIES.styles[0];
  const r = ACCESSORIES.ranges[0];
  const saved = JSON.parse(serializeOverrides({ page: { whatsapp: '919079914601' }, order: [], ranges: { [r.id]: { name: r.name } }, styles: { [s.sku]: { name: s.name, code: 'NEW' } } }));
  assert.deepEqual(saved, { page: {}, order: [], ranges: {}, styles: { [s.sku]: { code: 'NEW' } } });
});

test('owner order goes first, the rest follow in series order', () => {
  const ids = orderedRanges({ ...emptyOverrides(), order: ['y96', 'y4'] }).map((r) => r.id);
  assert.deepEqual(ids.slice(0, 2), ['y96', 'y4']);
  assert.equal(ids.length, ACCESSORIES.ranges.length);
  const eff = effectiveCatalogue({ ...emptyOverrides(), ranges: { y4: { hidden: true } }, styles: { [ACCESSORIES.styles[0].sku]: { hidden: true } } });
  assert.equal(eff.ranges.find((r) => r.id === 'y4')!.hidden, true);
  assert.ok(eff.styles.filter((s) => s.cat === 'y4').every((s) => s.rangeHidden));
});

test('the page applies the edits before it draws', () => {
  const start = html.indexOf('const CATS = [');
  const end = html.indexOf('const CAT = Object.fromEntries');
  const first = ACCESSORIES.styles.find((s) => s.cat === 'braided')!;
  const second = ACCESSORIES.styles.filter((s) => s.cat === 'braided')[1];
  const ACC_OV = {
    page: { title: 'Accessories', whatsapp: '911234567890' }, order: ['y4'],
    ranges: { mesh: { hidden: true }, braided: { name: 'Silk Bands' } },
    styles: { [first.sku]: { hidden: true }, [second.sku]: { out: true, code: 'ZZZ' } }
  };
  const ctx: any = { window: { ACC_OV }, document: { title: '' } };
  vm.runInNewContext(`${html.slice(start, end)}\n;globalThis.__out = { CATS, P, ORD, PAGE_TITLE };`, ctx, { timeout: 20000 });
  const { CATS, P, ORD, PAGE_TITLE } = ctx.__out;
  assert.ok(!CATS.some((c: any) => c.id === 'mesh'));
  assert.ok(!P.some((p: any) => p.cat === 'mesh'));
  assert.equal(CATS.find((c: any) => c.id === 'braided').name, 'Silk Bands');
  assert.ok(!P.some((p: any) => p.sku === first.sku));
  const p2 = P.find((p: any) => p.sku === second.sku);
  assert.equal(p2.out, true);
  assert.equal(p2.code, 'ZZZ');
  assert.equal(ORD.get('y4'), 0);
  assert.equal(PAGE_TITLE, 'Accessories');
  assert.equal(ctx.document.title, 'YOYO GEMS Accessories');
  assert.match(html, /const WA_NUMBER = \/\^\\d\{8,15\}\$\/\.test\(OVP\.whatsapp/);
  assert.match(html, /<script src="\/api\/accessories\/overrides"><\/script>\n<script>/);
});

test('with no edits the page is exactly as built', () => {
  const start = html.indexOf('const CATS = [');
  const end = html.indexOf('const CAT = Object.fromEntries');
  const ctx: any = { window: {}, document: { title: 'YOYO GEMS Accessories' } };
  vm.runInNewContext(`${html.slice(start, end)}\n;globalThis.__out = { n: P.length, c: CATS.length };`, ctx, { timeout: 20000 });
  assert.equal(ctx.__out.n, ACCESSORIES.styles.length);
  assert.equal(ctx.__out.c, ACCESSORIES.ranges.length);
});
