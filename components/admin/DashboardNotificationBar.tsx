'use client';

import { useEffect, useState } from 'react';

type Notification = {
  id: number;
  type: 'new_order' | 'order_modified';
  order_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Reuses the exact same backend as NotificationBell (GET /api/admin/notifications,
// POST /api/admin/notifications/mark-read) -- this is just a second, more visible
// surface for the same unread new_order/order_modified events, right on the
// dashboard instead of behind a bell click. Dismissing here marks it read, same
// as opening it from the bell would.
export default function DashboardNotificationBar() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/admin/notifications')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setItems((data.notifications || []).filter((n: Notification) => !n.is_read)); })
      .finally(() => setLoaded(true));
  }, []);

  function dismiss(id: number) {
    setItems((cur) => cur.filter((n) => n.id !== id));
    fetch('/api/admin/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
  }

  if (!loaded || items.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
      {items.map((n) => (
        <div
          key={n.id}
          className="card"
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', background: '#f4e6d0' }}
        >
          <a href={`/admin/orders/${n.order_id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: 1, minWidth: 0, color: 'var(--ink)' }}>
            <span style={{ fontSize: 13 }}>{n.message}</span>
            <span style={{ fontSize: 11, color: '#756e5c' }}>{timeAgo(n.created_at)}</span>
          </a>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => dismiss(n.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#756e5c', padding: '2px 6px', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
