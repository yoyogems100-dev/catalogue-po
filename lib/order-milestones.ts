// These are the seven values the database's own `orders_status_check`
// constraint allows, in order. Keep this list in sync with that constraint:
// anything missing here cannot be set from admin, renders as a raw lowercase
// key wherever a label is shown (including the customer's PDF), and -- worst --
// makes milestoneIndex() return -1, so the status dropdown silently falls back
// to "Placed" on an order that is actually further along.
export const ORDER_MILESTONES = [
  { key: 'placed', label: 'Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'sourcing', label: 'Sourcing' },
  { key: 'quality_check', label: 'Quality check' },
  { key: 'packed', label: 'Packed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' }
];

export const CANCELLED_STATUS = { key: 'cancelled', label: 'Cancelled' };

export const ORDER_STATUS_OPTIONS = [...ORDER_MILESTONES, CANCELLED_STATUS];

export function milestoneIndex(status: string) {
  return ORDER_MILESTONES.findIndex((m) => m.key === status);
}

export function milestoneLabel(status: string) {
  return ORDER_STATUS_OPTIONS.find((m) => m.key === status)?.label || status;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  placed: { bg: '#e6ecf5', fg: '#1B3A6B' },
  confirmed: { bg: '#e6f0ea', fg: '#1f7a4d' },
  sourcing: { bg: '#ece9f5', fg: '#4a3f86' },
  quality_check: { bg: '#e4f1f4', fg: '#1f6b7a' },
  packed: { bg: '#eef0e6', fg: '#5d6b27' },
  shipped: { bg: '#f3e9d8', fg: '#9C7A25' },
  delivered: { bg: '#e1f3e1', fg: '#217a34' },
  cancelled: { bg: '#f8e2e0', fg: '#a3372c' }
};

export function milestoneColor(status: string) {
  return STATUS_COLORS[status] || { bg: '#eee', fg: '#3A3F44' };
}
