import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// Runs the customer-interests migration twice against a minimal customers
// table and checks existing buyers get an empty, visible shelf.
const db = new PGlite();
try {
  await db.exec(`CREATE TABLE public.customers(id serial primary key, name text, go_to_requirements text);
    INSERT INTO public.customers(name) VALUES ('Asha'), ('Ravi');`);
  const sql = readFileSync('supabase/migrations/20261007090000_customer_interests.sql', 'utf8');
  await db.exec(sql);
  await db.exec(sql); // repeat-safe
  const rows = (await db.query(`SELECT interest_category_ids, show_interests FROM customers ORDER BY id`)).rows;
  assert.deepEqual(rows, [{ interest_category_ids: [], show_interests: true }, { interest_category_ids: [], show_interests: true }]);
  await db.exec(`UPDATE customers SET interest_category_ids = '{12,3}' WHERE name = 'Asha'`);
  assert.deepEqual((await db.query(`SELECT interest_category_ids FROM customers WHERE name = 'Asha'`)).rows[0].interest_category_ids, [12, 3], 'order is kept');
  console.log('customer_interests migration: ok');
} finally {
  await db.close();
}
