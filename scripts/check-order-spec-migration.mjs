import {PGlite} from '@electric-sql/pglite';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const db=new PGlite();try{
 await db.exec("CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE TABLE categories(id integer primary key);CREATE TABLE shape_sizes(id integer primary key);CREATE TABLE order_items(id integer primary key,color_id integer NOT NULL,quantity integer);INSERT INTO categories VALUES(29);INSERT INTO shape_sizes VALUES(10);INSERT INTO order_items VALUES(1,4,5);");
 const sql=readFileSync('supabase/migrations/20260911160000_category_order_specs.sql','utf8');await db.exec(sql);await db.exec(sql);
 await db.exec("INSERT INTO rainbow_strip_options VALUES(29,10,ARRAY[56,100]);INSERT INTO order_items VALUES(2,NULL,200,'{\"kind\":\"rainbow\",\"colorMode\":\"default\",\"stonesPerStrip\":100,\"colors\":[]}');");
 assert.equal((await db.query('SELECT order_specs FROM order_items WHERE id=2')).rows[0].order_specs.stonesPerStrip,100);
 assert.equal((await db.query('SELECT color_id FROM order_items WHERE id=1')).rows[0].color_id,4);
 await assert.rejects(db.exec('UPDATE rainbow_strip_options SET allowed_counts=ARRAY[0]'));
 assert.equal((await db.query("SELECT has_table_privilege('anon','rainbow_strip_options','UPDATE') AS writable")).rows[0].writable,false);
 console.log('PASS: migration repeats, legacy rows intact, configured counts constrained, structured order details preserved.');
}finally{await db.close();}
