import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PAYMENT_STATUS_OPTIONS, isPaymentStatus, normalizePaymentStatus, paymentStatusLabel,
  buyerPaymentStatus, isNaNotSupportedError
} from '../lib/payment-status';

test('N/A comes first in the admin choices, then pending / partially paid / paid', () => {
  assert.deepEqual(PAYMENT_STATUS_OPTIONS.map((o) => o.key), ['na', 'pending', 'partial', 'paid']);
  assert.deepEqual(PAYMENT_STATUS_OPTIONS.map((o) => o.label), ['N/A', 'Pending', 'Partially paid', 'Paid']);
});

test('only the four statuses are accepted by the admin route', () => {
  for (const k of ['na', 'pending', 'partial', 'paid']) assert.equal(isPaymentStatus(k), true);
  for (const k of ['', 'PAID', 'unknown', null, undefined, 3]) assert.equal(isPaymentStatus(k), false);
});

test('missing or unknown values count as N/A', () => {
  assert.equal(normalizePaymentStatus(null), 'na');
  assert.equal(normalizePaymentStatus(undefined), 'na');
  assert.equal(normalizePaymentStatus('weird'), 'na');
  assert.equal(normalizePaymentStatus('paid'), 'paid');
  assert.equal(paymentStatusLabel(null), 'N/A');
  assert.equal(paymentStatusLabel('partial'), 'Partially paid');
});

test('buyers see nothing about payment while it is N/A', () => {
  assert.equal(buyerPaymentStatus('na'), null);
  assert.equal(buyerPaymentStatus(null), null);
  assert.equal(buyerPaymentStatus('pending'), 'pending');
  assert.equal(buyerPaymentStatus('partial'), 'partial');
  assert.equal(buyerPaymentStatus('paid'), 'paid');
});

test('recognises the old database refusing N/A before the migration', () => {
  assert.equal(isNaNotSupportedError('new row for relation "orders" violates check constraint "orders_payment_status_check"'), true);
  assert.equal(isNaNotSupportedError('some other error'), false);
  assert.equal(isNaNotSupportedError(undefined), false);
});

test('buyer pages and app API go through buyerPaymentStatus', () => {
  for (const f of ['app/po/account/orders/page.tsx', 'app/po/account/orders/[id]/page.tsx', 'app/api/app/orders/route.ts', 'app/api/app/orders/[id]/route.ts']) {
    const src = readFileSync(f, 'utf8');
    assert.match(src, /buyerPaymentStatus\(/, f);
    assert.doesNotMatch(src, /payment_status \|\| 'pending'/, f);
  }
});

test('order creation leaves payment status to the database default', () => {
  for (const f of ['app/api/orders/create/route.ts', 'app/api/admin/orders/create/route.ts']) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /payment_status/, f);
  }
});

test('migration makes N/A the default and keeps existing orders', () => {
  const sql = readFileSync('supabase/migrations/20261123090000_payment_status_na.sql', 'utf8');
  assert.match(sql, /SET DEFAULT 'na'/);
  assert.match(sql, /DROP CONSTRAINT IF EXISTS orders_payment_status_check/);
  assert.doesNotMatch(sql, /UPDATE\s+public\.orders/i);
});

test('reset of old-default orders is limited to the 30 listed IDs still pending', () => {
  const sql = readFileSync('supabase/migrations/20261123091000_reset_pending_payments_to_na.sql', 'utf8');
  assert.match(sql, /WHERE payment_status = 'pending'/);
  const ids = sql.match(/id IN \(([\d,]+)\)/)![1].split(',');
  assert.equal(ids.length, 30);
  assert.ok(!ids.includes('11'));
});
