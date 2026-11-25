import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
try {
  // Production shape as of 2026-11-23: NOT NULL, default 'pending', check on three values.
  await db.exec(`CREATE TABLE public.orders(
    id bigint primary key,
    payment_status text NOT NULL DEFAULT 'pending',
    updated_at timestamptz,
    CONSTRAINT orders_payment_status_check CHECK (payment_status = ANY (ARRAY['pending'::text, 'partial'::text, 'paid'::text]))
  );
  INSERT INTO public.orders VALUES (1, 'pending'), (2, 'paid'), (3, 'partial');`);
  await assert.rejects(db.query(`INSERT INTO public.orders(id, payment_status) VALUES (9, 'na')`));

  const sql = readFileSync('supabase/migrations/20261123090000_payment_status_na.sql', 'utf8');
  await db.exec(sql);
  await db.exec(sql);

  assert.deepEqual((await db.query('SELECT id, payment_status FROM public.orders ORDER BY id')).rows,
    [{ id: 1, payment_status: 'pending' }, { id: 2, payment_status: 'paid' }, { id: 3, payment_status: 'partial' }]);
  await db.exec('INSERT INTO public.orders(id) VALUES (4)');
  assert.equal((await db.query('SELECT payment_status FROM public.orders WHERE id = 4')).rows[0].payment_status, 'na');
  await db.query(`UPDATE public.orders SET payment_status = 'paid' WHERE id = 4`);
  await db.query(`UPDATE public.orders SET payment_status = 'na' WHERE id = 4`);
  await assert.rejects(db.query(`UPDATE public.orders SET payment_status = 'unknown' WHERE id = 4`));
  await assert.rejects(db.query(`UPDATE public.orders SET payment_status = NULL WHERE id = 4`));
  const cons = (await db.query(`SELECT count(*)::int AS n FROM pg_constraint WHERE conname = 'orders_payment_status_check'`)).rows[0].n;
  assert.equal(cons, 1);
  // Reset of the 30 old-default orders: explicit IDs, only while still 'pending'.
  await db.exec(`INSERT INTO public.orders(id, payment_status) VALUES (5, 'pending'), (31, 'paid'), (32, 'pending')`);
  const reset = readFileSync('supabase/migrations/20261123091000_reset_pending_payments_to_na.sql', 'utf8');
  await db.exec(reset);
  await db.exec(reset);
  assert.deepEqual((await db.query('SELECT id, payment_status FROM public.orders ORDER BY id')).rows, [
    { id: 1, payment_status: 'na' },      // old default -> N/A
    { id: 2, payment_status: 'paid' },    // already set by admin: kept
    { id: 3, payment_status: 'partial' }, // kept
    { id: 4, payment_status: 'na' },
    { id: 5, payment_status: 'na' },
    { id: 31, payment_status: 'paid' },   // in the list but no longer pending: kept
    { id: 32, payment_status: 'pending' } // newer order, not in the list: kept
  ]);
  console.log("PASS: reset touches only the listed orders that are still pending; repeatable.");
  console.log("PASS: repeatable; existing orders unchanged; new orders default to 'na'; admin can set na/pending/partial/paid; other values refused.");
} finally { await db.close(); }
