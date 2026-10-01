import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// Runs the notifications migration twice against the production shape of the
// table and checks old order rows survive and order-less rows are accepted.
const db = new PGlite();
try {
  await db.exec(`CREATE TABLE public.orders(id bigserial primary key);
    CREATE TABLE public.notifications(id bigserial primary key, type text not null,
      order_id bigint not null references public.orders(id) on delete cascade,
      message text not null, is_read boolean not null default false, created_at timestamptz not null default now());
    INSERT INTO public.orders DEFAULT VALUES;
    INSERT INTO public.notifications(type, order_id, message) VALUES ('new_order', 1, 'New order #1');`);
  const sql = readFileSync('supabase/migrations/20261009090000_admin_notifications_any_event.sql', 'utf8');
  await db.exec(sql);
  await db.exec(sql); // repeat-safe
  await db.exec(`INSERT INTO public.notifications(type, message, link) VALUES ('access_request', 'Sign-up request from Asha', '/admin')`);
  const rows = (await db.query(`SELECT type, order_id, link FROM notifications ORDER BY id`)).rows;
  assert.deepEqual(rows, [
    { type: 'new_order', order_id: 1, link: null },
    { type: 'access_request', order_id: null, link: '/admin' }
  ]);
  await db.exec(`DELETE FROM orders WHERE id = 1`);
  assert.equal((await db.query(`SELECT count(*)::int n FROM notifications`)).rows[0].n, 1, 'order cascade still works');
  console.log('admin_notifications_any_event migration: ok');
} finally {
  await db.close();
}
