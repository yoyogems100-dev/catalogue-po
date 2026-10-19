// Part deliveries on an order line: how much has gone out and what is left.
// Stored as order_items.sent_qty / needs_check. Before that migration runs the
// columns are simply absent and every line reads as nothing sent.

export type LineState = 'pending' | 'part' | 'sent';

export function sentOf(row: { sent_qty?: number | null }): number {
  const n = Number(row.sent_qty ?? 0);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

export function lineState(quantity: number, sent: number): LineState {
  if (sent <= 0) return 'pending';
  return quantity > 0 && sent < quantity ? 'part' : 'sent';
}

export function balanceOf(quantity: number, sent: number): number {
  return Math.max(0, quantity - sent);
}

/** Whether a database row carries the fulfilment columns yet. */
export function hasFulfilmentColumns(row: object | null | undefined): boolean {
  return !!row && 'sent_qty' in row;
}

/** A requested amount sent, as a whole number from 0 up to the line's quantity. */
export function parseSent(value: unknown, quantity: number): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : NaN;
  if (!Number.isSafeInteger(n) || n < 0) return null;
  return quantity > 0 ? Math.min(n, quantity) : n;
}
