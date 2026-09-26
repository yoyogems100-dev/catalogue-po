import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
try {
  await db.exec("CREATE TABLE public.customers(id bigint primary key, name text); INSERT INTO public.customers VALUES (1, 'Existing buyer');");
  const sql = readFileSync('supabase/migrations/20260928090000_customer_color_buttons.sql', 'utf8');
  await db.exec(sql);
  await db.exec(sql); // repeat-safe
  assert.equal((await db.query('SELECT color_buttons FROM public.customers WHERE id=1')).rows[0].color_buttons, null);
  await db.query('UPDATE public.customers SET color_buttons=$1 WHERE id=1', [JSON.stringify([4, 1])]);
  assert.deepEqual((await db.query('SELECT color_buttons FROM public.customers WHERE id=1')).rows[0].color_buttons, [4, 1]);
  await assert.rejects(db.query('UPDATE public.customers SET color_buttons=$1 WHERE id=1', [JSON.stringify({ red: true })]));
  await db.query('UPDATE public.customers SET color_buttons=NULL WHERE id=1');
  console.log('PASS: repeatable; existing buyers follow the shop (NULL); only a list is accepted.');
} finally { await db.close(); }
