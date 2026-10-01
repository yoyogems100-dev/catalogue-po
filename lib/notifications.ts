// The admin's notification feed: what happened, and which page it opens.
// Shared by the bell, the Overview and the Notifications page.

export type NotificationType = 'new_order' | 'order_modified' | 'access_request' | 'catalogue_request';

export type AdminNotification = {
  id: number;
  type: NotificationType | string;
  order_id: number | null;
  link: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
};

export const NOTIFICATION_KINDS: { type: NotificationType; label: string }[] = [
  { type: 'new_order', label: 'New orders' },
  { type: 'order_modified', label: 'Order changes' },
  { type: 'access_request', label: 'Sign-up requests' },
  { type: 'catalogue_request', label: 'Catalogue requests' }
];

export function notificationLabel(type: string) {
  switch (type) {
    case 'new_order': return 'New order';
    case 'order_modified': return 'Order changed';
    case 'access_request': return 'Sign-up request';
    case 'catalogue_request': return 'Catalogue request';
    default: return 'Update';
  }
}

/** The admin page a notification opens: its saved link, else its order, else the overview. */
export function notificationHref(n: Pick<AdminNotification, 'type' | 'order_id' | 'link'>) {
  if (n.link && n.link.startsWith('/admin')) return n.link;
  if (n.order_id) return `/admin/orders/${n.order_id}`;
  if (n.type === 'catalogue_request') return '/admin/site/leads';
  return '/admin';
}

export function timeAgo(iso: string, now = Date.now()) {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}
