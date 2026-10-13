import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
try {
  await db.exec(`
    CREATE TABLE public.categories(id int primary key);
    CREATE TABLE public.shapes(id serial primary key, name text not null, icon_key text, ref_photo_url text, sort_order int not null default 0, owner_category_id int, short_code text);
    CREATE UNIQUE INDEX shapes_shared_name_key ON public.shapes (name) WHERE owner_category_id IS NULL;
    CREATE UNIQUE INDEX shapes_owned_name_key ON public.shapes (owner_category_id, name) WHERE owner_category_id IS NOT NULL;
    CREATE TABLE public.shape_sizes(id serial primary key, shape_id int references shapes(id), size_mm text, weight_ct numeric);
    CREATE TABLE public.category_shapes(category_id int, shape_id int, primary key (category_id, shape_id));
    CREATE TABLE public.category_shape_sizes(category_id int, shape_size_id int, pcs_per_ct int, primary key (category_id, shape_size_id));
    CREATE TABLE public.colors(id serial primary key, name text not null, owner_category_id int);
    CREATE TABLE public.category_colors(category_id int, color_id int, primary key (category_id, color_id));
    CREATE TABLE public.settings(key text primary key, value text);
    INSERT INTO public.categories SELECT generate_series(1, 50);
    SELECT setval('shapes_id_seq', 100);
    INSERT INTO public.shapes(id, name, icon_key) VALUES (67, 'Oval Cabochon', 'oval'), (66, 'Oval', 'oval'), (68, 'Pear', 'pear');
    INSERT INTO public.shape_sizes(id, shape_id, size_mm) VALUES (900001, 67, '4x6'), (900002, 67, '50x50');
    INSERT INTO public.colors(id, name) VALUES (281, '5# Ruby');
    INSERT INTO public.settings VALUES ('shape_qualities', '{"12":{"5":["4A"]}}');
  `);
  // Supplier-chart links point at real master sizes; give PGlite enough of them.
  const sql = readFileSync('supabase/migrations/20261019090000_shape_cuts_osp_cabochon_sizes.sql', 'utf8');
  const maxSize = Math.max(...[...sql.matchAll(/\((\d+),(\d+)\)/g)].map((m) => Number(m[2])));
  await db.exec(`INSERT INTO public.shapes(id, name) VALUES (1, 'Round'); INSERT INTO public.shape_sizes(id, shape_id, size_mm) SELECT g, 1, g::text FROM generate_series(3, ${maxSize}) g ON CONFLICT DO NOTHING; SELECT setval('shape_sizes_id_seq', 900010);`);
  await db.exec(sql);
  const after1 = (await db.query('SELECT (SELECT count(*) FROM category_shape_sizes) a, (SELECT count(*) FROM shapes) b, (SELECT count(*) FROM shape_sizes) c')).rows[0];
  await db.exec(sql); // repeat-safe
  const after2 = (await db.query('SELECT (SELECT count(*) FROM category_shape_sizes) a, (SELECT count(*) FROM shapes) b, (SELECT count(*) FROM shape_sizes) c')).rows[0];
  assert.deepEqual(after2, after1);
  const one = async (q) => (await db.query(q)).rows[0];
  assert.equal((await one("SELECT name FROM colors WHERE id = 281")).name, 'Ruby #5');
  assert.ok(await one("SELECT 1 x FROM category_colors WHERE category_id = 2 AND color_id = 281"));
  const hw = (await one("SELECT id FROM shapes WHERE owner_category_id = 3 AND name = 'Green OSP HW'")).id;
  assert.equal(Number((await one("SELECT count(*) n FROM category_shape_sizes css JOIN shape_sizes z ON z.id = css.shape_size_id JOIN shapes s ON s.id = z.shape_id WHERE css.category_id = 3 AND s.owner_category_id = 3")).n), 20);
  assert.deepEqual(JSON.parse((await one("SELECT value FROM settings WHERE key = 'shape_qualities'")).value), { 12: { 5: ['4A'] }, 3: { [hw]: ['3A', 'AA'] } });
  assert.ok(await one("SELECT 1 x FROM shapes WHERE id = 67 AND name = 'Oval Cabochon (Pota)'"));
  assert.equal(Number((await one("SELECT count(*) n FROM category_shape_sizes css JOIN shape_sizes z ON z.id = css.shape_size_id JOIN shapes s ON s.id = z.shape_id WHERE css.category_id = 24 AND s.name LIKE '%Cabochon (Pota)'")).n), 26);
  assert.ok(await one("SELECT 1 x FROM shape_sizes WHERE shape_id = 67 AND size_mm = '50x50'")); // nothing removed
  // An admin's later change to Green OSP HW survives a re-run.
  await db.exec(`UPDATE settings SET value = '{"3":{"${hw}":["AA"]}}' WHERE key = 'shape_qualities'`);
  await db.exec(sql);
  assert.deepEqual(JSON.parse((await one("SELECT value FROM settings WHERE key = 'shape_qualities'")).value), { 3: { [hw]: ['AA'] } });
  console.log(`PASS: repeatable; ${after1.a} links; Ruby #5, OSP Flat/HW (3A/AA), Oval/Pear Cabochon (Pota); admin edits kept; nothing removed.`);
} finally { await db.close(); }
