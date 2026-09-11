import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
try {
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
 const sql = readFileSync('supabase/migrations/20260911100000_hot_selling_options.sql','utf8');
 await db.exec(sql); await db.exec(sql);
 await db.exec("INSERT INTO hot_selling_options VALUES ('color',1),('shape',1),('size',91);");
 assert.equal((await db.query('SELECT * FROM hot_selling_options')).rows.length,3);
 const { rows } = await db.query("SELECT has_table_privilege('anon','hot_selling_options','SELECT') AS readable, has_table_privilege('anon','hot_selling_options','INSERT') AS writable, has_table_privilege('authenticated','hot_selling_options','UPDATE') AS customer_update, relrowsecurity FROM pg_class WHERE oid = 'hot_selling_options'::regclass");
 assert.deepEqual(rows[0],{readable:true,writable:false,customer_update:false,relrowsecurity:true});
 await db.exec("DELETE FROM hot_selling_options WHERE kind='color' AND option_id=1");
 assert.equal((await db.query("SELECT * FROM hot_selling_options WHERE kind='shape' AND option_id=1")).rows.length,1);
 console.log('PASS: repeatable hot-selling migration, independent option types, public read-only privileges and RLS.');
} finally { await db.close(); }
