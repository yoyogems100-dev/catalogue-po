import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
try {
 await db.exec(`CREATE TABLE categories(id integer PRIMARY KEY,slug text UNIQUE); CREATE TABLE colors(id serial PRIMARY KEY,name text UNIQUE,ref_photo_url text,sort_order integer); CREATE TABLE category_colors(category_id integer REFERENCES categories(id),color_id integer REFERENCES colors(id),PRIMARY KEY(category_id,color_id)); CREATE TABLE test_order_items(color_id integer REFERENCES colors(id)); INSERT INTO categories VALUES(16,'glass-pearls'),(2,'other'); INSERT INTO colors(name,sort_order) VALUES('Existing gold',1); INSERT INTO category_colors VALUES(16,1),(2,1); INSERT INTO test_order_items VALUES(1);`);
 const sql=readFileSync(new URL('../supabase/migrations/20260910190000_glass_pearl_colors.sql',import.meta.url),'utf8');
 await db.exec(sql);await db.exec(sql);
 const result=await db.query('SELECT colors.name FROM category_colors JOIN colors ON colors.id=color_id WHERE category_id=16');
 const chart=JSON.parse(readFileSync(new URL('../docs/glass-pearl-colors.json',import.meta.url),'utf8'));
 assert.deepEqual(result.rows.map(x=>x.name).sort(),chart.map(x=>x.label).sort());
 assert.equal((await db.query('SELECT count(*)::int n FROM colors')).rows[0].n,25);
 assert.equal((await db.query('SELECT color_id FROM category_colors WHERE category_id=2')).rows[0].color_id,1);
 assert.equal((await db.query('SELECT color_id FROM test_order_items')).rows[0].color_id,1);
 console.log('PASS: 24 exact pearl colors, repeatable migration, other category links and historical color references preserved. Synthetic database only.');
} finally {await db.close()}
