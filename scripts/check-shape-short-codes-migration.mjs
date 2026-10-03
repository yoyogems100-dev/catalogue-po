import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
try {
  await db.exec(`
    CREATE TABLE public.shapes(id serial primary key, name text not null, owner_category_id int);
    INSERT INTO public.shapes(name, owner_category_id) VALUES ('Heart', null), ('Heart', 45), ('Oval', null), ('Round', null), ('Marquise', null), ('Pear', null);
  `);
  const sql = readFileSync('supabase/migrations/20261012090000_shape_short_codes.sql', 'utf8');
  await db.exec(sql);
  await db.exec("UPDATE shapes SET short_code = 'RND' WHERE name = 'Round'"); // an admin edit
  await db.exec(sql); // repeat-safe, and keeps the edit
  const codes = Object.fromEntries((await db.query("SELECT name || coalesce(':' || owner_category_id, '') k, short_code FROM shapes")).rows.map((r) => [r.k, r.short_code]));
  assert.deepEqual(codes, { Heart: 'HS', 'Heart:45': 'HS', Oval: 'OS', Round: 'RND', Marquise: 'MQ', Pear: null });
  console.log('PASS: repeatable; HS/OS/RD/MQ seeded; admin edits kept; other shapes untouched.');
} finally { await db.close(); }
