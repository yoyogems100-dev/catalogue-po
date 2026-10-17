import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
try {
  // The shape of production that matters: the G colours, the category's
  // earlier price groups holding some of them, Round's duplicate size rows
  // ("4", "4.0", "4.00" with only "4.0" linked), and two sheet sizes missing.
  await db.exec(`
    CREATE TABLE colors(id serial primary key, name text not null, owner_category_id int);
    CREATE TABLE categories(id int primary key);
    INSERT INTO categories VALUES (1), (2);
    CREATE TABLE category_colors(category_id int, color_id int, primary key (category_id, color_id));
    CREATE TABLE color_price_groups(id serial primary key, name text unique not null, sort_order int not null default 0, is_catch_all boolean not null default false, category_id int);
    CREATE TABLE color_price_group_members(group_id int, color_id int, primary key (group_id, color_id));
    CREATE TABLE shape_sizes(id serial primary key, shape_id int not null, size_mm text not null);
    CREATE TABLE category_shapes(category_id int, shape_id int, primary key (category_id, shape_id));
    CREATE TABLE category_shape_sizes(category_id int, shape_size_id int, primary key (category_id, shape_size_id));
    CREATE TABLE shape_size_prices(category_id int, shape_id int, shape_size_id int, price_group_id int, price_inr numeric, price_rmb numeric,
      primary key (category_id, shape_id, shape_size_id, price_group_id));

    INSERT INTO colors(name) SELECT 'G-' || lpad(n::text, 2, '0') || ' Colour' FROM generate_series(1, 66) n;
    INSERT INTO colors(name) SELECT 'G-' || n || ' Colour' FROM generate_series(69, 84) n;
    INSERT INTO colors(name, owner_category_id) VALUES ('G-40 Other Category', 2);
    INSERT INTO category_colors SELECT 1, id FROM colors WHERE owner_category_id IS NULL
      AND split_part(name, ' ', 1) NOT IN ('G-03','G-04','G-23','G-25','G-26','G-29','G-43','G-47','G-50','G-51','G-62','G-64','G-06');
    INSERT INTO color_price_groups(id, name, category_id) VALUES (2, 'White Zircon', 1), (3, 'Premium Colors', 1), (9, 'Other Cat Group', 2);
    INSERT INTO color_price_groups(id, name, is_catch_all) VALUES (12, 'All other colors', true);
    SELECT setval('color_price_groups_id_seq', 20);
    INSERT INTO color_price_group_members SELECT 2, id FROM colors WHERE name = 'G-40 Colour';
    INSERT INTO color_price_group_members SELECT 3, id FROM colors WHERE name IN ('G-18 Colour', 'G-31 Colour');
    INSERT INTO color_price_group_members SELECT 9, id FROM colors WHERE name = 'G-18 Colour';

    INSERT INTO shape_sizes(shape_id, size_mm)
      SELECT s, z FROM unnest(array[63,66,68]) s, unnest(array['2x3','3x4','3x5','4x6','5x7','6x8','7x9','8x10','9x11','10x12','10x14']) z
      WHERE NOT (s = 63 AND z = '2x3');
    INSERT INTO shape_sizes(shape_id, size_mm)
      SELECT s, n || 'x' || n FROM unnest(array[3,23,6]) s, generate_series(4, 12) n WHERE NOT (s = 3 AND n = 11);
    INSERT INTO shape_sizes(shape_id, size_mm) SELECT 1, n::text FROM generate_series(4, 12) n;
    INSERT INTO shape_sizes(shape_id, size_mm) SELECT 1, n || '.0' FROM generate_series(4, 12) n;
    INSERT INTO shape_sizes(shape_id, size_mm) SELECT 1, n || '.00' FROM generate_series(4, 12) n;
    INSERT INTO category_shapes SELECT 1, s FROM unnest(array[1,3,6,23,63,66,68]) s;
    INSERT INTO category_shape_sizes SELECT 1, id FROM shape_sizes WHERE shape_id <> 1 OR size_mm LIKE '%.0';
    INSERT INTO shape_size_prices SELECT 1, shape_id, id, 2, 8.8, 0.8 FROM shape_sizes WHERE shape_id = 6;
  `);
  const sql = readFileSync('supabase/migrations/20261017090000_crushed_ice_g_series_prices.sql', 'utf8');
  await db.exec(sql);
  await db.exec(sql); // repeat-safe
  const one = async (q) => Number((await db.query(q)).rows[0].n);
  const price = async (shape, size, group) => Number((await db.query(`
    SELECT p.price_inr n FROM shape_size_prices p JOIN shape_sizes ss ON ss.id = p.shape_size_id
    JOIN color_price_groups g ON g.id = p.price_group_id
    WHERE p.category_id = 1 AND p.shape_id = ${shape} AND ss.size_mm = '${size}' AND g.name = '${group}'`)).rows[0]?.n);

  assert.equal(await one("SELECT count(*) n FROM color_price_groups WHERE name LIKE 'G-Series %' AND category_id = 1"), 5);
  // 3 shapes x 11 sizes + 3 x 9 + Round 9 = 69 cells, 5 columns each.
  assert.equal(await one("SELECT count(*) n FROM shape_size_prices p JOIN color_price_groups g ON g.id = p.price_group_id WHERE g.name LIKE 'G-Series %'"), 69 * 5);
  assert.equal(await price(63, '2x3', 'G-Series A · White D'), 17);
  assert.equal(await price(68, '10x14', 'G-Series E'), 961);
  assert.equal(await price(66, '3x4', 'G-Series E'), 73);
  assert.equal(await price(3, '11x11', 'G-Series D'), 321);
  assert.equal(await price(23, '4x4', 'G-Series C'), 23);
  assert.equal(await price(6, '7x7', 'G-Series B'), 41);
  assert.equal(await price(1, '12.0', 'G-Series E'), 961);
  // Round priced on the linked "N.0" row only, never its duplicates.
  assert.equal(await one("SELECT count(*) n FROM shape_size_prices p JOIN shape_sizes ss ON ss.id = p.shape_size_id WHERE p.shape_id = 1 AND ss.size_mm NOT LIKE '%.0'"), 0);
  assert.equal(await one("SELECT count(*) n FROM shape_sizes WHERE shape_id = 1"), 27);
  // The two missing sizes now exist once and are linked.
  assert.equal(await one("SELECT count(*) n FROM shape_sizes ss JOIN category_shape_sizes c ON c.shape_size_id = ss.id WHERE (ss.shape_id, ss.size_mm) IN ((63, '2x3'), (3, '11x11'))"), 2);
  // 65 codes on the sheet (1 + 13 + 15 + 28 + 8), each in exactly one column of this category.
  assert.equal(await one("SELECT count(*) n FROM color_price_group_members m JOIN color_price_groups g ON g.id = m.group_id WHERE g.category_id = 1"), 65);
  assert.equal(await one("SELECT count(*) n FROM (SELECT m.color_id FROM color_price_group_members m JOIN color_price_groups g ON g.id = m.group_id WHERE g.category_id = 1 GROUP BY 1 HAVING count(*) > 1) x"), 0);
  // Earlier groups and their prices kept; another category's group untouched.
  assert.equal(await one("SELECT count(*) n FROM shape_size_prices WHERE price_group_id = 2"), 9);
  assert.equal(await one("SELECT count(*) n FROM color_price_group_members WHERE group_id = 9"), 1);
  // Every sheet code offered; nothing unlinked; the other category's colour left alone.
  // 69 linked before + the 12 sheet codes that weren't = 81 (G-06 stays off).
  assert.equal(await one("SELECT count(*) n FROM category_colors WHERE category_id = 1"), 81);
  assert.equal(await one("SELECT count(*) n FROM category_colors cc JOIN colors c ON c.id = cc.color_id WHERE c.owner_category_id IS NOT NULL"), 0);
  assert.equal(await one("SELECT count(*) n FROM colors c WHERE split_part(c.name, ' ', 1) = 'G-06' AND EXISTS (SELECT 1 FROM category_colors cc WHERE cc.color_id = c.id)"), 0);
  assert.equal(await one(`SELECT count(*) n FROM colors c JOIN color_price_group_members m ON m.color_id = c.id
    JOIN color_price_groups g ON g.id = m.group_id AND g.category_id = 1
    WHERE NOT EXISTS (SELECT 1 FROM category_colors cc WHERE cc.category_id = 1 AND cc.color_id = c.id)`), 0);
  console.log('PASS: repeatable; 5 G-Series columns x 69 shape sizes priced; 65 codes, one column each; earlier prices kept.');
} finally { await db.close(); }
