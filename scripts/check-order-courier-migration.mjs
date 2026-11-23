import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
try {
  await db.exec(`CREATE TABLE public.orders(id bigint primary key, status text NOT NULL DEFAULT 'placed');
  INSERT INTO public.orders VALUES (1, 'placed'), (2, 'shipped');`);
  const sql = readFileSync('supabase/migrations/20261123120000_order_courier_dispatch.sql', 'utf8');
  await db.exec(sql);
  await db.exec(sql);
  assert.deepEqual((await db.query('SELECT id, status, courier, dispatch_from_jaipur FROM public.orders ORDER BY id')).rows, [
    { id: 1, status: 'placed', courier: null, dispatch_from_jaipur: false },
    { id: 2, status: 'shipped', courier: null, dispatch_from_jaipur: false }
  ]);
  await db.exec(`INSERT INTO public.orders(id) VALUES (3)`);
  await db.query(`UPDATE public.orders SET courier = 'DTDC', dispatch_from_jaipur = true WHERE id = 3`);
  assert.deepEqual((await db.query('SELECT courier, dispatch_from_jaipur FROM public.orders WHERE id = 3')).rows[0], { courier: 'DTDC', dispatch_from_jaipur: true });
  await assert.rejects(db.query(`UPDATE public.orders SET dispatch_from_jaipur = NULL WHERE id = 3`));
  console.log('PASS: repeatable; existing orders stay China route with no courier; new columns writable.');
} finally { await db.close(); }
