'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { NOTIFICATION_KINDS, notificationHref, notificationLabel, timeAgo, type AdminNotification } from '@/lib/notifications';

async function markRead(body: { id: number } | { all: true }) {
  await fetch('/api/admin/notifications/mark-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).catch(() => {});
}

function Row({ n, onOpen }: { n: AdminNotification; onOpen: (n: AdminNotification) => void }) {
  return (
    <li className={`notif-row ${n.is_read ? '' : 'notif-unread'}`}>
      <Link href={notificationHref(n)} onClick={() => onOpen(n)}>
        <span className={`notif-kind notif-kind-${n.type}`}>{notificationLabel(n.type)}</span>
        <span className="notif-message">{n.message}</span>
        <time className="notif-time" dateTime={n.created_at}>{timeAgo(n.created_at)}</time>
      </Link>
    </li>
  );
}

/**
 * The Overview's "Notifications" section: the latest few, unread first-class,
 * with a link to the full page. Checks again every 30 seconds.
 */
export function NotificationsPreview() {
  const [items, setItems] = useState<AdminNotification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/notifications?limit=5').catch(() => null);
    if (!res?.ok) { setFailed(true); return; }
    setFailed(false);
    const data = await res.json();
    setItems(data.notifications || []);
    setUnread(data.unreadCount || 0);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  function open(n: AdminNotification) {
    if (!n.is_read) markRead({ id: n.id });
  }

  return (
    <section className="card notif-section" aria-labelledby="notif-heading">
      <div className="notif-head">
        <h2 id="notif-heading">Notifications {unread > 0 && <span className="notif-count">{unread} new</span>}</h2>
        <div className="notif-head-actions">
          {unread > 0 && <button type="button" className="btn-ghost" onClick={async () => { await markRead({ all: true }); load(); }}>Mark all read</button>}
          <Link className="btn-ghost" href="/admin/notifications">View all</Link>
        </div>
      </div>
      {failed && items === null ? <p className="notif-empty" role="alert">Notifications could not be loaded. Please refresh.</p>
        : items === null ? <p className="notif-empty">Loading…</p>
        : items.length === 0 ? <p className="notif-empty">Nothing yet. New orders, order changes, sign-up requests and catalogue requests show up here.</p>
        : <ul className="notif-list">{items.map((n) => <Row key={n.id} n={n} onOpen={open} />)}</ul>}
    </section>
  );
}

/** The full Notifications page: every notification, filterable, 30 at a time. */
export default function NotificationsFeed() {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [type, setType] = useState('');

  const load = useCallback(async (before?: number) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '30' });
    if (onlyUnread) params.set('unread', '1');
    if (type) params.set('type', type);
    if (before) params.set('before', String(before));
    const res = await fetch(`/api/admin/notifications?${params}`).catch(() => null);
    setLoading(false);
    if (!res?.ok) { setFailed(true); return; }
    setFailed(false);
    const data = await res.json();
    setItems((cur) => (before ? [...cur, ...(data.notifications || [])] : data.notifications || []));
    setHasMore(!!data.hasMore);
    setUnread(data.unreadCount || 0);
  }, [onlyUnread, type]);

  useEffect(() => { load(); }, [load]);

  function open(n: AdminNotification) {
    if (n.is_read) return;
    markRead({ id: n.id });
    setItems((cur) => cur.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
  }

  async function readAll() {
    await markRead({ all: true });
    load();
  }

  return (
    <>
      <div className="notif-filters" role="toolbar" aria-label="Filter notifications">
        <div className="notif-toggle" role="group" aria-label="Show">
          <button type="button" aria-pressed={!onlyUnread} onClick={() => setOnlyUnread(false)}>All</button>
          <button type="button" aria-pressed={onlyUnread} onClick={() => setOnlyUnread(true)}>Unread{unread ? ` (${unread})` : ''}</button>
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Kind of notification">
          <option value="">Everything</option>
          {NOTIFICATION_KINDS.map((k) => <option key={k.type} value={k.type}>{k.label}</option>)}
        </select>
        {unread > 0 && <button type="button" className="btn-ghost" onClick={readAll}>Mark all read</button>}
      </div>
      <div className="card notif-section">
        {failed ? <p className="notif-empty" role="alert">Notifications could not be loaded. Please refresh.</p>
          : !loading && items.length === 0 ? <p className="notif-empty">{onlyUnread ? 'You are all caught up.' : 'No notifications yet.'}</p>
          : <ul className="notif-list">{items.map((n) => <Row key={n.id} n={n} onOpen={open} />)}</ul>}
        {loading && <p className="notif-empty">Loading…</p>}
        {hasMore && !loading && (
          <div className="notif-more"><button type="button" className="btn-ghost" onClick={() => load(items[items.length - 1]?.id)}>Show older</button></div>
        )}
      </div>
    </>
  );
}
