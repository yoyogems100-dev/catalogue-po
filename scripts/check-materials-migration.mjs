import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.categories(id integer primary key, name text);
    INSERT INTO public.categories VALUES (2, 'Ruby Corundum'), (26, 'Ruby Opaque (Chatam)'), (23, 'Ruby Glass Filled');`);
  const sql = readFileSync('supabase/migrations/20260926090000_materials.sql', 'utf8');
  await db.exec(sql);
  await db.exec(sql); // repeat-safe
  await db.exec(`INSERT INTO public.materials(name, sort_order) VALUES ('Ruby', 1), ('Glass', 2);`);
  await assert.rejects(db.exec(`INSERT INTO public.materials(name) VALUES (' ruby ')`)); // same name, different case/spacing
  await assert.rejects(db.exec(`INSERT INTO public.materials(name) VALUES ('  ')`));
  // Many-to-many: Ruby Glass Filled under both Ruby and Glass.
  await db.exec(`INSERT INTO public.material_categories VALUES (1, 2), (1, 26), (1, 23), (2, 23);`);
  assert.equal((await db.query('SELECT count(*)::int n FROM public.material_categories WHERE category_id = 23')).rows[0].n, 2);
  // Deleting a material only drops its links, never a category.
  await db.exec('DELETE FROM public.materials WHERE id = 2');
  assert.equal((await db.query('SELECT count(*)::int n FROM public.categories')).rows[0].n, 3);
  assert.equal((await db.query('SELECT count(*)::int n FROM public.material_categories')).rows[0].n, 3);
  await assert.rejects(db.exec('INSERT INTO public.material_categories VALUES (1, 999)'));
  console.log('PASS: repeatable; unique names; many-to-many; deleting a material keeps its categories.');
} finally { await db.close(); }
