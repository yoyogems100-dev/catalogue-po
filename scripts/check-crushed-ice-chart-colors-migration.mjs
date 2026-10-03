import { PGlite } from '@electric-sql/pglite';
import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
try {
  // The shape of production that matters: the G list (G-01..G-66), 24 of them on Crushed Ice Cut,
  // and a same-named colour owned by another category that must be left alone.
  await db.exec(`
    CREATE TABLE public.colors(id serial primary key, name text not null, hex_value text, ref_photo_url text, sort_order int not null default 0, owner_category_id int);
    CREATE UNIQUE INDEX colors_shared_name_key ON public.colors (name) WHERE owner_category_id IS NULL;
    CREATE TABLE public.color_palettes(id serial primary key, name text unique, sort_order int);
    CREATE TABLE public.color_palette_items(palette_id int, color_id int, primary key (palette_id, color_id));
    CREATE TABLE public.category_colors(category_id int, color_id int, primary key (category_id, color_id));
    INSERT INTO public.color_palettes(name) VALUES ('G - Crushed Ice Cut');
    INSERT INTO public.colors(name, sort_order) SELECT 'G-' || lpad(n::text, 2, '0') || ' Colour ' || n, 58 + n FROM generate_series(1, 66) n;
    INSERT INTO public.colors(name, owner_category_id) VALUES ('G-70 Mars Stone', 99);
    INSERT INTO public.category_colors SELECT 1, id FROM public.colors WHERE split_part(name, ' ', 1) IN
      ('G-05','G-08','G-14','G-15','G-18','G-27','G-28','G-31','G-32','G-35','G-38','G-39','G-40','G-41','G-42','G-45','G-53','G-54','G-55','G-56','G-57','G-60','G-61','G-66');
  `);
  const sql = readFileSync('supabase/migrations/20261010090000_crushed_ice_chart_colors.sql', 'utf8');
  await db.exec(sql);
  await db.exec(sql); // repeat-safe
  const one = async (q) => Number((await db.query(q)).rows[0].n);
  assert.equal(await one("SELECT count(*) n FROM colors WHERE owner_category_id IS NULL"), 66 + 16);
  assert.equal(await one('SELECT count(*) n FROM category_colors WHERE category_id = 1'), 24 + 22 + 16);
  assert.equal(await one("SELECT count(*) n FROM category_colors cc JOIN colors c ON c.id = cc.color_id WHERE c.owner_category_id IS NOT NULL"), 0);
  assert.equal(await one("SELECT count(*) n FROM color_palette_items"), 16);
  // Every chart code is now on the category.
  const chart = 'G-70 G-01 G-02 G-84 G-71 G-05 G-46 G-07 G-08 G-12 G-13 G-14 G-15 G-72 G-66 G-40 G-73 G-74 G-49 G-75 G-24 G-16 G-17 G-18 G-19 G-20 G-21 G-76 G-77 G-78 G-79 G-80 G-30 G-31 G-32 G-33 G-34 G-37 G-38 G-39 G-35 G-36 G-60 G-61 G-58 G-59 G-57 G-56 G-81 G-55 G-54 G-82 G-83 G-69 G-52 G-53 G-41 G-42 G-44 G-45'.split(' ');
  assert.equal(chart.length, 60);
  const linked = new Set((await db.query("SELECT split_part(c.name, ' ', 1) code FROM category_colors cc JOIN colors c ON c.id = cc.color_id WHERE cc.category_id = 1")).rows.map((r) => r.code));
  assert.deepEqual(chart.filter((c) => !linked.has(c)), []);
  // Each new colour's photo exists.
  for (const { ref_photo_url } of (await db.query("SELECT ref_photo_url FROM colors WHERE name ~ '^G-(69|7[0-9]|8[0-4]) ' AND owner_category_id IS NULL")).rows)
    assert.ok(existsSync('public' + ref_photo_url), ref_photo_url);
  console.log('PASS: repeatable; all 60 chart colours on Crushed Ice Cut; 16 new colours with photos; nothing removed.');
} finally { await db.close(); }
