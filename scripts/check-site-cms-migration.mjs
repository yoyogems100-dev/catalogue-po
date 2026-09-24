import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// Runs the website CMS migration twice against a stub catalogue and checks the
// seed, the two-level rule and that anonymous readers never see drafts.
const slugs = ['crushed-ice-cut','ruby-synthetic','nano','turkey-ring-stones','ruby-green-cabs','lab-grown-stones','evil-eye-malachite','mop-onyx','synthetic-opals','fusion-stones','coloured-cz-stones','queen-conch','cz-glass-beads','glass-stones','glass-pearls','crystal','foiled-glass-crystal','flat-polki-foil-polki','hole-punched-stones','natural-emeralds','natural-pearls','ruby-glass-filled','semi-precious-stones','green-onyx-chatam','ruby-opaque-chatam','preform-balls','fancy-special-shapes','rainbow-corundum','star-light','7a-quality','moissanite','3a-quality-cz','4a-quality-cz','5a-quality-cz','heighted-cz-stones','high-density-cz','ceramic','synthetic-corundum','malachite','mop-mother-of-pearl'];
const db = new PGlite();
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE categories(id serial primary key, slug text unique, name text);
    GRANT USAGE ON SCHEMA public TO anon;`);
  for (const s of slugs) await db.query('INSERT INTO categories(slug,name) VALUES($1,$1)', [s]);
  const sql = readFileSync('supabase/migrations/20260925100000_site_cms.sql', 'utf8');
  await db.exec(sql);
  await db.exec(sql); // repeat-safe
  const count = async (q) => Number((await db.query(q)).rows[0].n);
  assert.equal(await count('SELECT count(*) n FROM site_categories WHERE parent_id IS NULL'), 11);
  assert.equal(await count('SELECT count(*) n FROM site_categories WHERE parent_id IS NOT NULL'), 39);
  assert.equal(await count('SELECT count(*) n FROM site_grades'), 6);
  assert.equal(await count('SELECT count(*) n FROM site_category_sources'), 41);
  // Every catalogue category is placed somewhere.
  assert.equal(await count('SELECT count(*) n FROM categories c WHERE NOT EXISTS (SELECT 1 FROM site_category_sources s WHERE s.category_id=c.id)'), 0);
  assert.equal(await count(`SELECT count(*) n FROM site_category_grades g JOIN site_categories c ON c.id=g.site_category_id WHERE c.slug='white-cz'`), 4);

  // Two levels only.
  await assert.rejects(db.exec(`INSERT INTO site_categories(parent_id,slug,name) SELECT id,'x','x' FROM site_categories WHERE slug='white-cz'`), /cannot contain/);
  await assert.rejects(db.exec(`UPDATE site_categories SET parent_id=(SELECT id FROM site_categories WHERE slug='polki') WHERE slug='cz'`), /cannot be moved/);

  // Anonymous readers: published only, never drafts or leads.
  await db.exec(`UPDATE site_pages SET draft='{"secret":1}', published='{"ok":1}' WHERE key='home'`);
  await db.exec(`INSERT INTO site_leads(name,business_city,whatsapp) VALUES('a','b','9')`);
  await db.exec('SET ROLE anon');
  assert.deepEqual((await db.query(`SELECT key, published FROM site_pages`)).rows, [{ key: 'home', published: { ok: 1 } }]);
  await assert.rejects(db.query('SELECT draft FROM site_pages'), /permission denied/);
  await assert.rejects(db.query('SELECT * FROM site_leads'), /permission denied/);
  assert.equal(await count(`SELECT count(*) n FROM site_categories WHERE slug='jewellery-findings'`), 0); // hidden
  await db.exec('RESET ROLE');
  console.log('PASS: site CMS migration is repeatable, seeds 11+39 categories, enforces two levels and hides drafts/leads from anon.');
} finally { await db.close(); }
