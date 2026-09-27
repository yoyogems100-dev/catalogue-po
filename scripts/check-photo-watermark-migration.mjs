import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// Runs the watermark-originals migration twice against minimal copies of the
// tables it touches and checks the columns and the private bucket.
const db = new PGlite();
try {
  await db.exec(`CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text primary key, name text not null, public boolean default false);
    INSERT INTO storage.buckets VALUES ('photos', 'photos', true);
    CREATE TABLE photos(id serial primary key, storage_path text, drive_id text);
    CREATE TABLE site_media(id serial primary key, storage_path text not null);
    INSERT INTO photos(storage_path) VALUES ('1/a.jpg');
    INSERT INTO photos(drive_id) VALUES ('abcDEF123');
    INSERT INTO site_media(storage_path) VALUES ('site/x.webp');`);

  const sql = readFileSync('supabase/migrations/20260930090000_photo_watermark_originals.sql', 'utf8');
  await db.exec(sql);
  await db.exec(sql); // repeat-safe

  const buckets = (await db.query(`SELECT id, public FROM storage.buckets ORDER BY id`)).rows;
  assert.deepEqual(buckets, [{ id: 'originals', public: false }, { id: 'photos', public: true }]);
  assert.equal(Number((await db.query(`SELECT count(*) n FROM photos WHERE original_path IS NULL`)).rows[0].n), 2, 'existing photos untouched');
  assert.equal(Number((await db.query(`SELECT count(*) n FROM site_media WHERE original_path IS NULL`)).rows[0].n), 1, 'existing media untouched');
  await db.exec(`UPDATE photos SET original_path = '1/a.jpg' WHERE id = 1; UPDATE site_media SET original_path = 'site/x.webp'`);
  console.log('photo_watermark_originals migration: ok');
} finally {
  await db.close();
}
