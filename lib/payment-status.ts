// Order payment status.
//
// 'na' means "not set yet": the team hasn't recorded anything about payment
// for this order. It is the default for new orders (after migration
// 20261123090000_payment_status_na) and buyers see nothing about payment
// while an order is N/A. Admin switches it to pending / partial / paid.

export const PAYMENT_STATUSES = ['na', 'pending', 'partial', 'paid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_OPTIONS: { key: PaymentStatus; label: string }[] = [
  { key: 'na', label: 'N/A' },
  { key: 'pending', label: 'Pending' },
  { key: 'partial', label: 'Partially paid' },
  { key: 'paid', label: 'Paid' }
];

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === 'string' && (PAYMENT_STATUSES as readonly string[]).includes(value);
}

/** Anything missing or unknown counts as N/A ("not set"). */
export function normalizePaymentStatus(value: unknown): PaymentStatus {
  return isPaymentStatus(value) ? value : 'na';
}

export function paymentStatusLabel(value: unknown): string {
  const key = normalizePaymentStatus(value);
  return PAYMENT_STATUS_OPTIONS.find((o) => o.key === key)!.label;
}

/**
 * What a buyer may see: null while payment is N/A (show nothing),
 * otherwise the status key.
 */
export function buyerPaymentStatus(value: unknown): Exclude<PaymentStatus, 'na'> | null {
  const key = normalizePaymentStatus(value);
  return key === 'na' ? null : key;
}

/**
 * True when a database error is the old check constraint refusing 'na',
 * i.e. the migration hasn't been applied to this database yet.
 */
export function isNaNotSupportedError(message: string | null | undefined): boolean {
  return !!message && /orders_payment_status_check/.test(message);
}
