import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Runs the real migrations twice against a disposable in-memory copy of the
// tables they touch. The live database is not contacted.
const base = readFileSync(new URL('../supabase/migrations/20261103090000_coin_stone_colours.sql', import.meta.url), 'utf8');
const sql = readFileSync(new URL('../supabase/migrations/20261123090000_coin_stone_monalisa_white.sql', import.meta.url), 'utf8');
const db = new PGlite();
try {
  await db.exec(`
    create table public.categories (id int primary key, name text);
    create table public.colors (id serial primary key, name text not null, hex_value text, sort_order int, owner_category_id int references public.categories(id), ref_photo_url text);
    create unique index colors_owned_name_key on public.colors (owner_category_id, name) where owner_category_id is not null;
    create table public.category_colors (category_id int, color_id int, primary key (category_id, color_id));
    insert into public.categories values (3, 'Nano'), (49, 'Coin Stone');
  `);
  await db.exec(base);
  await db.exec(sql);
  await db.exec(sql);
  const own = (await db.query(`select name from public.colors where owner_category_id = 49 order by sort_order`)).rows;
  assert.deepEqual(own.map((r) => r.name), ['Monalisa White', 'Monalisa Pink', 'Monalisa Mint', 'Black', 'Red', 'Green', 'Blue']);
  assert.equal((await db.query(`select count(*)::int n from public.category_colors where category_id = 49`)).rows[0].n, 7);
  console.log('Coin Stone Monalisa White migration: one new own colour, linked once, repeat-safe.');
} finally {
  await db.close();
}
