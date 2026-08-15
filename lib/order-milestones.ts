export const ORDER_MILESTONES = [
  { key: 'placed', label: 'Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'sourcing', label: 'Sourcing' },
  { key: 'quality_check', label: 'Quality Check' },
  { key: 'packed', label: 'Packed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' }
];

export function milestoneIndex(status: string) {
  return ORDER_MILESTONES.findIndex((m) => m.key === status);
}

export function milestoneLabel(status: string) {
  return ORDER_MILESTONES.find((m) => m.key === status)?.label || status;
}
