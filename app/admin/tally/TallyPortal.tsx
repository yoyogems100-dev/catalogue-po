'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ask, type Answer, type TallyIndex } from '@/lib/tally/query';
import { day, ago } from '@/lib/tally/format';
import { LiveSyncPanel, UploadBox, changePassword, isOnline, minutesAgo, useLiveSync } from './TallyApp';
import { AskTab, CustomersTab, DaybookTab, ItemsTab, ItemView, PartyView } from './views';

export type Route =
  | { tab: 'ask' | 'customers' | 'items' | 'daybook' }
  | { party: string }
  | { item: string };

export type Go = (r: Route) => void;
export type Turn = { id: number; q: string; a: Answer };

function parseHash(h: string): Route {
  const s = h.replace(/^#/, '');
  if (s.startsWith('party/')) return { party: decodeURIComponent(s.slice(6)) };
  if (s.startsWith('item/')) return { item: decodeURIComponent(s.slice(5)) };
  if (s === 'customers' || s === 'items' || s === 'daybook') return { tab: s };
  return { tab: 'ask' };
}
function toHash(r: Route) {
  if ('party' in r) return `#party/${encodeURIComponent(r.party)}`;
  if ('item' in r) return `#item/${encodeURIComponent(r.item)}`;
  return r.tab === 'ask' ? '#ask' : `#${r.tab}`;
}

const TABS: { key: 'ask' | 'customers' | 'items' | 'daybook'; label: string }[] = [
  { key: 'ask', label: 'Ask' },
  { key: 'customers', label: 'Customers' },
  { key: 'items', label: 'Items & stock' },
  { key: 'daybook', label: 'Day book' }
];

export default function TallyPortal({ ix, onReload, onRefresh, onLock }: { ix: TallyIndex; onReload: () => void; onRefresh: () => void; onLock: () => void }) {
  // New data from the Tally computer swaps in by itself, without a reload.
  const live = useLiveSync(onRefresh);
  const [route, setRoute] = useState<Route>({ tab: 'ask' });
  const [thread, setThread] = useState<Turn[]>([]);
  const [settings, setSettings] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    const sync = () => setRoute(parseHash(window.location.hash));
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const go: Go = useCallback((r) => {
    const h = toHash(r);
    if (window.location.hash !== h) window.location.hash = h;
    else setRoute(r);
    requestAnimationFrame(() => top.current?.scrollIntoView({ block: 'start' }));
  }, []);

  const onAsk = useCallback((q: string) => {
    const text = q.trim();
    if (!text) return;
    const a = ask(ix, text);
    setThread((t) => [{ id: nextId.current++, q: text, a }, ...t].slice(0, 30));
    go({ tab: 'ask' });
  }, [ix, go]);

  const activeTab = 'tab' in route ? route.tab : null;
  const m = ix.data.meta;

  return (
    <div className="tp" ref={top}>
      <header className="tp-head">
        <div>
          <h1>Tally accounts</h1>
          <p className="tp-sub">{m.company} · entries from {day(m.firstDate)} to {day(m.lastDate)}</p>
          {live.info?.hasKey ? (
            <p className={`tp-live-badge ${isOnline(live.info) ? 'on' : 'off'}`}>
              <i aria-hidden /> {isOnline(live.info) ? 'Live from Tally' : 'Sync program offline'}
              {live.info.lastSyncAt && <> · updated {minutesAgo(live.info.lastSyncAt)}</>}
              {live.info.computer && <span className="tp-dim"> · {live.info.computer}</span>}
            </p>
          ) : (
            <p className="tp-sub">From an uploaded Excel · {ago(m.uploadedAt.slice(0, 10), new Date().toISOString().slice(0, 10))}</p>
          )}
        </div>
        <div className="tp-head-actions">
          {live.info?.hasKey && (
            <button className="btn" onClick={live.syncNow} disabled={live.waiting || !isOnline(live.info)} title={isOnline(live.info) ? 'Read Tally again now' : 'The sync program on the Tally computer is not running'}>
              {live.waiting ? 'Syncing…' : 'Sync now'}
            </button>
          )}
          <button className="btn-ghost" onClick={() => setSettings(true)}>Sync settings</button>
          <button className="btn-ghost" onClick={onLock} title="Lock the Tally accounts on this device">Lock</button>
        </div>
      </header>

      <nav className="tp-tabs" aria-label="Tally sections">
        {TABS.map((t) => (
          <button key={t.key} className={activeTab === t.key ? 'on' : ''} aria-current={activeTab === t.key ? 'page' : undefined} onClick={() => go({ tab: t.key })}>{t.label}</button>
        ))}
      </nav>

      {'party' in route ? <PartyView ix={ix} name={route.party} go={go} />
        : 'item' in route ? <ItemView ix={ix} query={route.item} go={go} />
        : route.tab === 'customers' ? <CustomersTab ix={ix} go={go} />
        : route.tab === 'items' ? <ItemsTab ix={ix} go={go} />
        : route.tab === 'daybook' ? <DaybookTab ix={ix} go={go} />
        : <AskTab ix={ix} thread={thread} onAsk={onAsk} go={go} onClear={() => setThread([])} />}

      {settings && <Settings onClose={() => setSettings(false)} onReload={() => { setSettings(false); onReload(); }} onRefresh={onRefresh} fileName={m.fileName} uploadedAt={m.uploadedAt} />}
    </div>
  );
}

function Settings({ onClose, onReload, onRefresh, fileName, uploadedAt }: { onClose: () => void; onReload: () => void; onRefresh: () => void; fileName: string; uploadedAt: string }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function change(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try { await changePassword(cur, next); setMsg({ ok: true, text: 'Password changed. Other devices are now locked.' }); setCur(''); setNext(''); }
    catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not change it.' }); }
    finally { setBusy(false); }
  }

  return (
    <div className="tp-modal" role="dialog" aria-modal="true" aria-label="Update data and password" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tp-modal-card">
        <button className="tp-close" onClick={onClose} aria-label="Close">×</button>
        <LiveSyncPanel onSynced={onRefresh} />
        <hr />
        <h2>Or upload an Excel once</h2>
        <p className="tp-muted">Now showing <strong>{fileName}</strong>, from {day(uploadedAt.slice(0, 10))}. An uploaded Excel replaces the current data until the next live sync.</p>
        <UploadBox compact onDone={onReload} />
        <hr />
        <h2>Change the Tally password</h2>
        <form onSubmit={change} className="tp-form">
          <label>Current password<input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required /></label>
          <label>New password<input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={6} required /></label>
          {msg && <p className={msg.ok ? 'tp-ok' : 'tp-error'} role="status">{msg.text}</p>}
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
        </form>
      </div>
    </div>
  );
}
