import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
try {
  await db.exec("CREATE TABLE customers(id bigint primary key, name text); INSERT INTO customers VALUES (1, 'Existing buyer');");
  const sql = readFileSync('supabase/migrations/20260925100000_customer_order_preferences.sql', 'utf8');
  await db.exec(sql);
  await db.exec(sql); // repeat-safe
  assert.deepEqual((await db.query('SELECT order_preferences FROM customers WHERE id=1')).rows[0].order_preferences, []);
  await db.query('UPDATE customers SET order_preferences=$1 WHERE id=1', [JSON.stringify([{ familyId: 4, categoryId: 2, grade: '5A' }])]);
  assert.deepEqual((await db.query('SELECT order_preferences FROM customers WHERE id=1')).rows[0].order_preferences, [{ familyId: 4, categoryId: 2, grade: '5A' }]);
  await assert.rejects(db.query('UPDATE customers SET order_preferences=NULL WHERE id=1'));
  console.log('PASS: repeatable migration; existing customers default to an empty list; NULL rejected.');
} finally { await db.close(); }
