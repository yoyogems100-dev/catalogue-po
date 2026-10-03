import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
try {
  await db.exec(`
    CREATE TABLE public.customers(id bigint primary key, name text, phone text);
    CREATE TABLE public.orders(id bigint primary key, customer_id bigint references public.customers(id));
    INSERT INTO public.customers VALUES (1, 'Mahi', '6376512595'), (2, 'Buyer', '9000000000');
    INSERT INTO public.orders VALUES (10, 2);
  `);
  const sql = readFileSync('supabase/migrations/20261011090000_order_for_other_customers.sql', 'utf8');
  await db.exec(sql);
  await db.exec(sql); // repeat-safe
  const allowed = (await db.query('SELECT id FROM customers WHERE can_order_for_others ORDER BY id')).rows.map((r) => Number(r.id));
  assert.deepEqual(allowed, [1]);
  assert.equal((await db.query('SELECT placed_by_customer_id FROM orders WHERE id = 10')).rows[0].placed_by_customer_id, null);
  await db.exec('UPDATE orders SET placed_by_customer_id = 1 WHERE id = 10');
  await db.exec('DELETE FROM customers WHERE id = 1');
  assert.equal((await db.query('SELECT placed_by_customer_id FROM orders WHERE id = 10')).rows[0].placed_by_customer_id, null);
  console.log('PASS: repeatable; only customer 1 (Mahi) allowed; existing orders untouched; deleting the enterer keeps the order.');
} finally { await db.close(); }
