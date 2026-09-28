import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
const n = async (sql) => (await db.query(sql)).rows[0].n;
try {
  // The production shape of the tables these migrations touch.
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.categories(id integer primary key, name text);
    CREATE TABLE public.shapes(id serial primary key, name text not null, icon_key text, ref_photo_url text, sort_order integer not null default 0, CONSTRAINT shapes_name_key UNIQUE (name));
    CREATE TABLE public.shape_sizes(id serial primary key, shape_id integer references public.shapes(id) on delete cascade, size_mm text, weight_ct numeric);
    CREATE TABLE public.colors(id serial primary key, name text not null, hex_value text, ref_photo_url text, sort_order integer not null default 0, CONSTRAINT colors_name_key UNIQUE (name));
    CREATE TABLE public.category_shapes(category_id integer references public.categories(id) on delete cascade, shape_id integer references public.shapes(id) on delete cascade, ref_photo_url text, reference_style text default 'vector', primary key (category_id, shape_id));
    CREATE TABLE public.category_shape_sizes(category_id integer references public.categories(id) on delete cascade, shape_size_id integer references public.shape_sizes(id) on delete cascade, primary key (category_id, shape_size_id));
    CREATE TABLE public.category_colors(category_id integer references public.categories(id) on delete cascade, color_id integer references public.colors(id) on delete cascade, primary key (category_id, color_id));
    INSERT INTO public.categories VALUES (1, 'CZ'), (45, 'Semi Precious Beads');
    INSERT INTO public.shapes(name) VALUES ('Heart'), ('Oval');
    INSERT INTO public.colors(name) VALUES ('Amethyst');`);
  const schema = readFileSync('supabase/migrations/20261001090000_category_materials.sql', 'utf8');
  const seed = readFileSync('supabase/migrations/20261001091000_semi_precious_beads_seed.sql', 'utf8');
  await db.exec(schema);
  await db.exec(schema); // repeat-safe
  await db.exec(seed);
  await db.exec(seed); // repeat-safe: no duplicates on a second run

  assert.equal((await db.query('SELECT option_label FROM public.categories WHERE id = 45')).rows[0].option_label, 'Material');
  assert.equal((await db.query('SELECT option_label FROM public.categories WHERE id = 1')).rows[0].option_label, null);
  assert.equal(await n('SELECT count(*)::int n FROM public.shapes WHERE owner_category_id = 45'), 7);
  assert.equal(await n('SELECT count(*)::int n FROM public.category_shapes WHERE category_id = 45'), 7);
  assert.equal(await n('SELECT count(*)::int n FROM public.category_shape_sizes WHERE category_id = 45'), 8);
  assert.equal(await n('SELECT count(*)::int n FROM public.colors WHERE owner_category_id = 45'), 44);
  assert.equal(await n('SELECT count(*)::int n FROM public.category_colors WHERE category_id = 45'), 44);
  assert.equal(await n('SELECT count(*)::int n FROM public.category_size_colors WHERE category_id = 45'), 105);
  // Shared rows untouched, and the bead "Heart"/"Amethyst" live beside them.
  assert.equal(await n(`SELECT count(*)::int n FROM public.shapes WHERE name = 'Heart'`), 2);
  assert.equal(await n(`SELECT count(*)::int n FROM public.colors WHERE name = 'Amethyst'`), 2);
  assert.equal(await n('SELECT count(*)::int n FROM public.colors WHERE owner_category_id IS NULL'), 1);
  // Spot checks against the owner's list.
  assert.equal(await n(`SELECT count(*)::int n FROM public.category_size_colors x JOIN public.shape_sizes ss ON ss.id = x.shape_size_id JOIN public.shapes s ON s.id = ss.shape_id WHERE s.name = 'Heart' AND s.owner_category_id = 45`), 24);
  assert.equal(await n(`SELECT count(*)::int n FROM public.category_size_colors x JOIN public.shape_sizes ss ON ss.id = x.shape_size_id JOIN public.shapes s ON s.id = ss.shape_id WHERE s.name = 'Four-Leaf Clover' AND ss.size_mm = '8x8'`), 15);
  assert.equal(await n(`SELECT count(*)::int n FROM public.shape_sizes ss JOIN public.shapes s ON s.id = ss.shape_id WHERE s.name = 'Plum Blossom' AND ss.size_mm = '6'`), 1);

  // Names stay unique among shared rows and within one category...
  await assert.rejects(db.exec(`INSERT INTO public.colors(name) VALUES ('Amethyst')`));
  await assert.rejects(db.exec(`INSERT INTO public.colors(name, owner_category_id) VALUES ('Rose Quartz', 45)`));
  await assert.rejects(db.exec(`INSERT INTO public.shapes(name, owner_category_id) VALUES ('Heart', 45)`));
  // ...but another category may reuse one.
  await db.exec(`INSERT INTO public.colors(name, owner_category_id) VALUES ('Rose Quartz', 1)`);
  await assert.rejects(db.exec(`UPDATE public.categories SET option_label = '  ' WHERE id = 45`));

  // Deleting a material removes only its availability rows.
  await db.exec(`DELETE FROM public.colors WHERE owner_category_id = 45 AND name = 'Rhodonite'`);
  assert.equal(await n('SELECT count(*)::int n FROM public.category_size_colors WHERE category_id = 45'), 104);
  console.log('PASS: repeatable; 7 shapes, 8 sizes, 44 materials, 105 shape/size/material rows; names scoped per category.');
} finally { await db.close(); }
