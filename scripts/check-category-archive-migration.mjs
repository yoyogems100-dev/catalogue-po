import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// Runs the category-archive migration twice against a minimal categories
// table with the same public read policy as production, then checks that the
// anon role only sees live categories while the owner still sees all.
const db = new PGlite();
try {
  await db.exec(`CREATE ROLE anon;
    CREATE TABLE public.categories(id serial primary key, num int, name text not null, slug text);
    ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "public read categories" ON public.categories FOR SELECT USING (true);
    GRANT SELECT ON public.categories TO anon;
    INSERT INTO public.categories(num, name, slug) VALUES (1, 'Ruby', 'ruby'), (2, 'Opal', 'opal');`);

  const sql = readFileSync('supabase/migrations/20261002090000_category_archive.sql', 'utf8');
  await db.exec(sql);
  await db.exec(sql); // repeat-safe

  assert.equal(Number((await db.query(`SELECT count(*) n FROM categories WHERE archived_at IS NULL`)).rows[0].n), 2, 'existing categories stay live');
  await db.exec(`UPDATE categories SET archived_at = now() WHERE slug = 'opal'`);

  await db.exec(`SET ROLE anon`);
  const visible = (await db.query(`SELECT slug FROM categories ORDER BY num`)).rows.map((r) => r.slug);
  await db.exec(`RESET ROLE`);
  assert.deepEqual(visible, ['ruby'], 'anon cannot read archived categories');
  assert.equal(Number((await db.query(`SELECT count(*) n FROM categories`)).rows[0].n), 2, 'owner still sees archived categories');
  console.log('category_archive migration: ok');
} finally {
  await db.close();
}
