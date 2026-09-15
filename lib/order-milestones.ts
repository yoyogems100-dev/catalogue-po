export const ORDER_MILESTONES = [
  { key: 'placed', label: 'Placed' },
  { key: 'confirmed', label: 'Confirmed' },
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
  shipped: { bg: '#f3e9d8', fg: '#9C7A25' },
  delivered: { bg: '#e1f3e1', fg: '#217a34' },
  cancelled: { bg: '#f8e2e0', fg: '#a3372c' }
};

export function milestoneColor(status: string) {
  return STATUS_COLORS[status] || { bg: '#eee', fg: '#3A3F44' };
}
