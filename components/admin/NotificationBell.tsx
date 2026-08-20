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

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const res = await fetch('/api/admin/notifications');
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.notifications || []);
    setUnreadCount(data.unreadCount || 0);
    setLoaded(true);
  }

  useEffect(() => {
    load();
    // Light polling so a new order/edit shows up without a manual refresh --
    // 30s is frequent enough to feel live without hammering the endpoint.
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  async function openNotification(n: Notification) {
    setOpen(false);
    if (!n.is_read) {
      await fetch('/api/admin/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: n.id })
      });
      load();
    }
    // New tab -- clicking a notification shouldn't lose whatever admin page
    // was already open.
    window.open(`/admin/orders/${n.order_id}`, '_blank', 'noopener,noreferrer');
  }

  async function markAllRead() {
    await fetch('/api/admin/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true })
    });
    load();
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); if (!loaded) load(); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', color: '#cbd3e0', position: 'relative',
          padding: 8, display: 'flex', alignItems: 'center'
        }}
        title="Notifications"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute', top: 2, right: 2, background: '#a3341f', color: '#fff', fontSize: 10,
              minWidth: 16, height: 16, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 4px', fontWeight: 600
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 55 }} onClick={() => setOpen(false)} />
          <div
            className="card"
            style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 60, width: 'min(320px, 92vw)',
              maxHeight: 420, overflowY: 'auto', background: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.18)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
              <strong style={{ fontSize: 13 }}>Notifications</strong>
              {unreadCount > 0 && (
                <button type="button" onClick={markAllRead} style={{ background: 'none', border: 'none', color: 'var(--navy)', fontSize: 11.5, cursor: 'pointer' }}>
                  Mark all read
                </button>
              )}
            </div>
            {items.length === 0 && <p style={{ padding: 16, fontSize: 12.5, color: '#756e5c' }}>No notifications yet.</p>}
            {items.map((n) => (
              <div
                key={n.id}
                onClick={() => openNotification(n)}
                style={{
                  padding: '10px 14px', borderBottom: '1px solid var(--line)', cursor: 'pointer', fontSize: 12.5,
                  background: n.is_read ? '#fff' : '#f4e6d0'
                }}
              >
                <div style={{ color: 'var(--ink)' }}>{n.message}</div>
                <div style={{ fontSize: 10.5, color: '#756e5c', marginTop: 3 }}>{timeAgo(n.created_at)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
