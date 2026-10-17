import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
try {
  await db.exec('CREATE TABLE public.order_items(id bigint primary key, quantity integer not null); INSERT INTO public.order_items VALUES (1, 1000), (2, 50);');
  const sql = readFileSync('supabase/migrations/20261022090000_order_item_fulfilment.sql', 'utf8');
  await db.exec(sql);
  await db.exec(sql);
  assert.deepEqual((await db.query('SELECT * FROM public.order_items ORDER BY id')).rows, [
    { id: 1, quantity: 1000, sent_qty: 0, needs_check: false },
    { id: 2, quantity: 50, sent_qty: 0, needs_check: false },
  ]);
  await db.query('UPDATE public.order_items SET sent_qty = 400, needs_check = true WHERE id = 1');
  await assert.rejects(db.query('UPDATE public.order_items SET sent_qty = -1 WHERE id = 2'));
  console.log('PASS: repeatable; existing lines start at nothing sent, not flagged; negative sent refused.');
} finally { await db.close(); }
