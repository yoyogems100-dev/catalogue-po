import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Runs the real migration twice against a disposable in-memory copy of the
// tables it touches. The live database is not contacted.
const sql = readFileSync(new URL('../supabase/migrations/20261103120000_color_admin_codes.sql', import.meta.url), 'utf8');
const db = new PGlite();
try {
  await db.exec(`
    create table public.colors (id serial primary key, name text not null, owner_category_id int);
    insert into public.colors (name, owner_category_id)
      select 'YOTCF-' || lpad(n::text, 2, '0'), 47 from generate_series(1, 24) n;
    insert into public.colors (name, owner_category_id) values ('YOTCF-05', null);
  `);
  await db.exec(sql);
  await db.query(`update public.color_admin_codes set code = 'changed' where color_id = (select id from public.colors where name = 'YOTCF-01' and owner_category_id = 47)`);
  await db.exec(sql);
  const rows = (await db.query(`select c.name, a.code from public.color_admin_codes a join public.colors c on c.id = a.color_id order by c.name`)).rows;
  assert.equal(rows.length, 17);
  assert.equal(rows.find((r) => r.name === 'YOTCF-05').code, '39');
  assert.equal(rows.find((r) => r.name === 'YOTCF-01').code, 'changed', 'an admin edit survives a re-run');
  assert.equal((await db.query(`select relrowsecurity from pg_class where relname = 'color_admin_codes'`)).rows[0].relrowsecurity, true);
  await db.exec(`delete from public.colors where name = 'YOTCF-02'`);
  assert.equal((await db.query(`select count(*)::int n from public.color_admin_codes`)).rows[0].n, 16, 'deleting a colour drops its code');
  console.log('Colour admin codes migration: 17 YOTCF codes, admin edits kept, RLS on, repeat-safe.');
} finally {
  await db.close();
}
