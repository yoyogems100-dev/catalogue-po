import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// Runs the explore-default-filter migration twice against a minimal
// categories table, then checks existing rows stay unset, an object saves,
// and anything that is not an object is refused.
const db = new PGlite();
try {
  await db.exec(`CREATE TABLE public.categories(id serial primary key, num int, name text not null, slug text);
    INSERT INTO public.categories(num, name, slug) VALUES (1, 'Ruby', 'ruby'), (2, 'Opal', 'opal');`);

  const sql = readFileSync('supabase/migrations/20261003090000_category_explore_default_filter.sql', 'utf8');
  await db.exec(sql);
  await db.exec(sql); // repeat-safe

  assert.equal(Number((await db.query(`SELECT count(*) n FROM categories WHERE explore_default_filter IS NULL`)).rows[0].n), 2, 'existing categories keep no default');
  await db.exec(`UPDATE categories SET explore_default_filter = '{"shape_id": 3, "size_key": "4x6"}' WHERE slug = 'ruby'`);
  const saved = (await db.query(`SELECT explore_default_filter f FROM categories WHERE slug = 'ruby'`)).rows[0].f;
  assert.deepEqual(saved, { shape_id: 3, size_key: '4x6' });
  await assert.rejects(db.exec(`UPDATE categories SET explore_default_filter = '[1,2]' WHERE slug = 'opal'`), 'arrays are refused');
  console.log('category_explore_default_filter migration: ok');
} finally {
  await db.close();
}
