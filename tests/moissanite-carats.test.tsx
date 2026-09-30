import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { caratSpec, caratsFor, quantityFactor, specText, validSpecQuantity, specKey } from '../lib/order-specs';
import { mergeIntoCart, type CartItem } from '../lib/cart-storage';

test('carats round pieces up to a whole carat', () => {
  assert.equal(caratsFor(124, 62), 2);
  assert.equal(caratsFor(130, 62), 3); // -> 186 pcs
  assert.equal(caratsFor(3 * 62, 62), 3);
  assert.equal(caratsFor(0, 62), 0);
  const spec = caratSpec(64);
  assert.equal(quantityFactor(spec), 64);
  assert.equal(specText(spec, 192), '3 ct (1ct = ~64 pcs)');
  assert.equal(validSpecQuantity(spec, 192), true);
  assert.equal(validSpecQuantity(spec, 130), false);
});

test('same size by carat merges into one line whose carats add up', () => {
  const base: CartItem = { id: 'a', categoryId: 34, categoryName: 'Moissanite', shapeId: 1, shapeName: 'Round', sizeId: 5, sizeMm: '1.5', colorId: 9, colorName: 'White (DEF)', colorHex: '#fff', qty: 128, requestType: 'Place Order', orderSpecs: caratSpec(64) };
  const merged = mergeIntoCart([base], { ...base, id: 'b', qty: 192 });
  assert.equal(merged.length, 1);
  assert.equal(specText(merged[0].orderSpecs, merged[0].qty), '5 ct (1ct = ~64 pcs)');
  assert.equal(specKey(merged[0].orderSpecs), specKey(caratSpec(64)));
});

test('server accepts carat lines only at the size\'s own rate', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'synthetic-test-key';
  const { validateOrderSpecs } = await import('../lib/validate-order-specs');
  const db = { from(table: string) { const q: any = { select() { return q; }, eq() { return q; }, limit() { return q; }, async maybeSingle() {
    const data = table === 'shape_sizes' ? { shape_id: 1 } : table === 'category_shape_sizes' ? { shape_size_id: 2, pcs_per_ct: 64 } : table === 'category_size_colors' ? null : { shape_id: 1, color_id: 9 };
    return { data, error: null }; }, then(r: any) { return Promise.resolve({ data: [], error: null }).then(r); } }; return q; } };
  const line = { categoryId: 34, shapeId: 1, sizeId: 2, colorId: 9, qty: 128, orderSpecs: caratSpec(64) };
  assert.deepEqual((await validateOrderSpecs([line], db))[0].orderSpecs, { kind: 'carat', pcsPerCt: 64 });
  await assert.rejects(() => validateOrderSpecs([{ ...line, orderSpecs: caratSpec(60), qty: 120 }], db), /carat conversion/);
  await assert.rejects(() => validateOrderSpecs([{ ...line, qty: 130 }], db), /whole quantities/);
});

test('melee migration sets pieces per carat on the 27 Round sizes below 3 mm only', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE categories(id int primary key,slug text);INSERT INTO categories VALUES(34,'moissanite'),(1,'other');
    CREATE TABLE shapes(id serial primary key,name text);INSERT INTO shapes(name) VALUES('Round'),('Princess'),('Round');
    CREATE TABLE shape_sizes(id serial primary key,shape_id int,size_mm text);
    CREATE TABLE category_shapes(category_id int,shape_id int);INSERT INTO category_shapes VALUES(34,1),(34,2),(1,3);
    CREATE TABLE category_shape_sizes(category_id int,shape_size_id int,primary key(category_id,shape_size_id));`);
    const sizes = ['0.7','0.8','0.9','1','1.1','1.2','1.25','1.3','1.4','1.5','1.6','1.7','1.75','1.8','1.9','2','2.1','2.2','2.25','2.3','2.4','2.5','2.6','2.7','2.75','2.8','2.9','3','3.25','6.5'];
    for (const s of sizes) { await db.query('INSERT INTO shape_sizes(shape_id,size_mm) VALUES(1,$1)', [s]); await db.query('INSERT INTO category_shape_sizes VALUES(34,currval(\'shape_sizes_id_seq\'))'); }
    await db.exec(`INSERT INTO shape_sizes(shape_id,size_mm) VALUES(2,'2x2'),(3,'1.5');INSERT INTO category_shape_sizes VALUES(34,31),(1,32);`);
    const sql = readFileSync('supabase/migrations/20261006090000_moissanite_melee_pcs_per_ct.sql', 'utf8');
    await db.exec(sql); await db.exec(sql);
    const rate = async (id: number, cat = 34) => (await db.query<{ p: number | null }>('SELECT pcs_per_ct p FROM category_shape_sizes WHERE category_id=$1 AND shape_size_id=$2', [cat, id])).rows[0].p;
    assert.equal(await rate(1), 580);
    assert.equal(await rate(10), 64); // 1.5 mm
    assert.equal(await rate(27), 10); // 2.9 mm
    assert.equal(await rate(28), null); // 3 mm: pieces only
    assert.equal(await rate(29), null); // 3.25 mm: pieces only
    assert.equal(await rate(31), null); // Princess
    assert.equal(await rate(32, 1), null); // another category's Round
  } finally { await db.close(); }
});
