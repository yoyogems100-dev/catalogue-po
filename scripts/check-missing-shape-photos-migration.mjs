import { PGlite } from '@electric-sql/pglite';
import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
try {
  await db.exec(`CREATE TABLE shapes(id bigint primary key, name text, icon_key text, ref_photo_url text, sort_order int);
    INSERT INTO shapes VALUES
      (10, 'D-Cut Shape', 'diamond', '/reference/stones/d-cut-shape.webp', 17),
      (13, 'Hexagon Queen Cut', 'hexagon', '/reference/stones/hexagon-queen-cut.webp', 33),
      (15, 'Eight Diagram', 'octagon', '/reference/stones/eight-diagram.webp', 25),
      (18, 'Hexagon Step Cut', 'hexagon', '/reference/stones/hexagon-step-cut.webp', 34),
      (22, 'Gourd', 'gourd', 'https://example.supabase.co/storage/v1/object/public/photos/gourd-upload.webp', 30),
      (24, 'Long Diamond Cut', 'diamond', '/reference/stones/long-diamond-cut.webp', 42),
      (26, 'Diamond Shape', 'diamond', '/reference/stones/diamond-shape.webp', 20),
      (28, 'Special Pear', 'oval', '/reference/stones/special-pear.webp', 68),
      (33, 'Baguette Princess', 'baguette', '/reference/stones/baguette-princess.webp', 36),
      (17, 'Half Moon', 'half-moon', '/reference/stones/half-moon.webp', 31),
      (99, 'Unrelated', 'diamond', '/reference/stones/d-cut-shape.webp', 99),
      (2, 'No photo', 'diamond', NULL, 2);`);
  const before = (await db.query('SELECT * FROM shapes ORDER BY id')).rows;
  const sql = readFileSync('supabase/migrations/20260925140000_null_missing_shape_photos.sql', 'utf8');
  await db.exec(sql);
  const once = (await db.query('SELECT * FROM shapes ORDER BY id')).rows;
  await db.exec(sql); // repeat-safe
  assert.deepEqual((await db.query('SELECT * FROM shapes ORDER BY id')).rows, once);

  const cleared = [10, 13, 15, 18, 24, 26, 28, 33];
  for (const row of once) {
    const old = before.find((b) => b.id === row.id);
    if (cleared.includes(row.id)) assert.deepEqual(row, { ...old, ref_photo_url: null }, `${row.name} should only lose its photo`);
    else assert.deepEqual(row, old, `${row.name} should be untouched`);
  }
  // Every path the migration clears really is missing from public/.
  for (const [, path] of sql.matchAll(/\(\d+, '([^']+)'\)/g)) assert.ok(!existsSync(`public${path}`), `${path} exists; do not clear it`);
  console.log('PASS: 8 broken paths cleared; a newer upload, other shapes and NULLs untouched; repeatable.');
} finally { await db.close(); }
