import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Runs the real migration twice against a disposable in-memory copy of the
// tables it touches. The live database is not contacted.
const sql = readFileSync(new URL('../supabase/migrations/20261103090000_coin_stone_colours.sql', import.meta.url), 'utf8');
const db = new PGlite();
try {
  await db.exec(`
    create table public.categories (id int primary key, name text);
    create table public.colors (id serial primary key, name text not null, hex_value text, sort_order int, owner_category_id int references public.categories(id), ref_photo_url text);
    create unique index colors_shared_name_key on public.colors (name) where owner_category_id is null;
    create unique index colors_owned_name_key on public.colors (owner_category_id, name) where owner_category_id is not null;
    create table public.category_colors (category_id int, color_id int, primary key (category_id, color_id));
    insert into public.categories values (3, 'Nano'), (49, 'Coin Stone');
    insert into public.colors (name, hex_value) values ('Green', '#3FAE6A'), ('Black', '#111');
    insert into public.category_colors values (3, 1);
  `);
  await db.exec(sql);
  await db.query(`update public.colors set ref_photo_url = '/custom.webp' where owner_category_id = 49 and name = 'Red'`);
  await db.exec(sql);
  const own = (await db.query(`select name, ref_photo_url from public.colors where owner_category_id = 49 order by sort_order`)).rows;
  assert.deepEqual(own.map((r) => r.name), ['Monalisa Pink', 'Monalisa Mint', 'Black', 'Red', 'Green', 'Blue']);
  assert.equal(own.find((r) => r.name === 'Red').ref_photo_url, '/custom.webp');
  assert.equal((await db.query(`select count(*)::int n from public.colors where owner_category_id is null`)).rows[0].n, 2, 'shared colours untouched');
  assert.equal((await db.query(`select count(*)::int n from public.category_colors where category_id = 49`)).rows[0].n, 6);
  assert.equal((await db.query(`select count(*)::int n from public.category_colors where category_id = 3`)).rows[0].n, 1);
  console.log('Coin Stone colours migration: six own colours linked, shared Green/Black untouched, repeat-safe.');
} finally {
  await db.close();
}
