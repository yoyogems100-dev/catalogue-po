import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// Runs the "website keeps its own photos" migration twice on top of the CMS
// migration and checks the new link type and the source_photo_id rule.
const db = new PGlite();
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE categories(id serial primary key, slug text unique, name text);
    GRANT USAGE ON SCHEMA public TO anon;`);
  await db.exec(readFileSync('supabase/migrations/20260925100000_site_cms.sql', 'utf8'));
  await db.exec(`INSERT INTO site_media(storage_path) VALUES('site/a.webp')`);
  await db.exec(`INSERT INTO site_media_links(media_id, target_type, target_id) VALUES(1, 'color', 4)`);
  await assert.rejects(db.exec(`INSERT INTO site_media_links(media_id, target_type, target_id) VALUES(1, 'grade', 2)`), /check constraint/);

  const sql = readFileSync('supabase/migrations/20260929090000_site_own_photos.sql', 'utf8');
  await db.exec(sql);
  await db.exec(sql); // repeat-safe

  await db.exec(`INSERT INTO site_media_links(media_id, target_type, target_id) VALUES(1, 'grade', 2)`);
  await assert.rejects(db.exec(`INSERT INTO site_media_links(media_id, target_type, target_id) VALUES(1, 'nope', 2)`), /check constraint/);
  assert.equal(Number((await db.query(`SELECT count(*) n FROM site_media_links`)).rows[0].n), 2, 'existing links kept');

  // One website copy per /po photo; hand uploads have no source.
  await db.exec(`UPDATE site_media SET source_photo_id = 77 WHERE id = 1`);
  await db.exec(`INSERT INTO site_media(storage_path) VALUES('site/b.webp'), ('site/c.webp')`);
  await assert.rejects(db.exec(`INSERT INTO site_media(storage_path, source_photo_id) VALUES('site/d.webp', 77)`), /duplicate key/);
  console.log('site_own_photos migration: ok');
} finally {
  await db.close();
}
