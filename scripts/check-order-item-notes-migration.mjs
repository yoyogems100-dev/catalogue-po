import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
try {
  await db.exec('CREATE TABLE public.order_items(id bigint primary key, quantity integer not null); INSERT INTO public.order_items VALUES (1, 500);');
  const sql = readFileSync('supabase/migrations/20261021090000_order_item_notes.sql', 'utf8');
  await db.exec(sql);
  await db.exec(sql);
  assert.deepEqual((await db.query('SELECT * FROM public.order_items')).rows[0], { id: 1, quantity: 500, note: null });
  await db.query('UPDATE public.order_items SET note = $1 WHERE id = 1', ['Radiant cut required']);
  await assert.rejects(db.query('UPDATE public.order_items SET note = $1 WHERE id = 1', ['x'.repeat(301)]));
  assert.equal((await db.query('SELECT note FROM public.order_items')).rows[0].note, 'Radiant cut required');
  console.log('PASS: repeatable; existing lines keep their data; notes over 300 characters are refused.');
} finally { await db.close(); }
