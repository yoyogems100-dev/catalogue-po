'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TallyData } from '@/lib/tally/types';
import { buildIndex } from '@/lib/tally/query';
import TallyPortal from './TallyPortal';

type Gate = 'setup' | 'locked' | 'open';

export default function TallyApp({ initialGate }: { initialGate: Gate }) {
  const [gate, setGate] = useState<Gate>(initialGate);
  return gate === 'open'
    ? <DataLoader onLocked={() => setGate('locked')} />
    : <PasswordScreen mode={gate} onOpen={() => setGate('open')} />;
}

async function post(body: Record<string, string>) {
  const res = await fetch('/api/admin/tally/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Something went wrong.');
}

function PasswordScreen({ mode, onOpen }: { mode: 'setup' | 'locked'; onOpen: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (mode === 'setup' && password !== confirm) { setError('The two passwords are different.'); return; }
    setBusy(true);
    try { await post({ action: mode === 'setup' ? 'setup' : 'login', password }); onOpen(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not unlock.'); setBusy(false); }
  }

  return (
    <div className="tp-lock">
      <form className="tp-lock-card" onSubmit={submit}>
        <div className="tp-lock-icon" aria-hidden>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>
        </div>
        <h1>{mode === 'setup' ? 'Create your Tally password' : 'Tally accounts are locked'}</h1>
        <p>{mode === 'setup'
          ? 'Your Tally accounts get their own password, separate from the admin login, so only you can see balances and ledgers. Choose one you will remember — at least 6 characters.'
          : 'Enter the Tally password to see customers, balances and orders. It stays unlocked on this device for 12 hours.'}</p>
        <label>Tally password
          <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete={mode === 'setup' ? 'new-password' : 'current-password'} minLength={6} required />
        </label>
        {mode === 'setup' && (
          <label>Type it again
            <input type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={6} required />
          </label>
        )}
        <label className="tp-check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show password</label>
        {error && <p className="tp-error" role="alert">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Please wait…' : mode === 'setup' ? 'Save password and open' : 'Unlock'}</button>
        {mode === 'locked' && <p className="tp-fine">Forgot it? Delete <code>auth.json</code> from the private <code>tally</code> storage bucket in Supabase, then set a new one here.</p>}
      </form>
    </div>
  );
}

type Load = { state: 'loading' } | { state: 'empty' } | { state: 'error'; message: string } | { state: 'ready'; data: TallyData };

function DataLoader({ onLocked }: { onLocked: () => void }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  // `silent` swaps in fresh data without the loading screen (used when a live sync lands).
  const fetchData = useCallback(async (silent?: boolean) => {
    if (!silent) setLoad({ state: 'loading' });
    try {
      const res = await fetch('/api/admin/tally/data', { cache: 'no-store' });
      if (res.status === 401) { onLocked(); return; }
      if (res.status === 404) { setLoad({ state: 'empty' }); return; }
      if (!res.ok) throw new Error(`The data could not be loaded (${res.status}).`);
      setLoad({ state: 'ready', data: await res.json() });
    } catch (e) {
      if (!silent) setLoad({ state: 'error', message: e instanceof Error ? e.message : 'The data could not be loaded.' });
    }
  }, [onLocked]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const ix = useMemo(() => (load.state === 'ready' ? buildIndex(load.data) : null), [load]);

  async function lock() {
    await post({ action: 'logout' }).catch(() => {});
    onLocked();
  }

  if (load.state === 'loading') return <div className="tp-loading"><span className="tp-spinner" aria-hidden /> Opening your Tally data…</div>;
  if (load.state === 'error') return <div className="tp-loading"><p className="tp-error">{load.message}</p><button className="btn" onClick={() => fetchData()}>Try again</button></div>;
  if (load.state === 'empty') {
    return (
      <div className="tp-empty">
        <h1>Tally accounts</h1>
        <p>No Tally data yet. Connect the live sync below so the portal reads straight from Tally — or upload the Excel extract from Tally once.</p>
        <LiveSyncPanel onSynced={() => fetchData(true)} />
        <UploadBox onDone={() => fetchData()} />
        <button className="tp-link" onClick={lock}>Lock</button>
      </div>
    );
  }
  return <TallyPortal ix={ix!} onReload={() => fetchData()} onRefresh={() => fetchData(true)} onLock={lock} />;
}

/* ---------------- live sync ---------------- */

export type SyncInfo = { hasKey: boolean; keyCreatedAt: string; requestedAt: string; lastSyncAt?: string; lastSeenAt?: string; computer?: string };

async function syncCall(action?: string): Promise<SyncInfo & { key?: string }> {
  const res = await fetch('/api/admin/tally/sync', action
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }
    : { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Could not reach the sync settings.');
  return json;
}

export function minutesAgo(iso?: string) {
  if (!iso) return '';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m <= 0 ? 'just now' : m === 1 ? '1 min ago' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
}

/** Polls sync status; calls onSynced when a newer sync has landed. */
export function useLiveSync(onSynced: () => void) {
  const [info, setInfo] = useState<SyncInfo | null>(null);
  const [waiting, setWaiting] = useState(false);
  const last = useRef<string | undefined>(undefined);
  const cb = useRef(onSynced);
  cb.current = onSynced;

  const refresh = useCallback(async () => {
    try {
      const s = await syncCall();
      setInfo(s);
      if (last.current !== undefined && s.lastSyncAt && s.lastSyncAt !== last.current) { setWaiting(false); cb.current(); }
      last.current = s.lastSyncAt || '';
    } catch { /* keep the last known status */ }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15_000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [refresh]);

  const syncNow = useCallback(async () => {
    setWaiting(true);
    try { await syncCall('request'); } catch { setWaiting(false); }
    setTimeout(() => setWaiting(false), 120_000);
  }, []);

  return { info, waiting, syncNow, refresh, setInfo };
}

/** Online = the sync program checked in within the last 3 minutes. */
export function isOnline(info: SyncInfo | null) {
  return Boolean(info?.lastSeenAt && Date.now() - Date.parse(info.lastSeenAt) < 180_000);
}

export function LiveSyncPanel({ onSynced }: { onSynced: () => void }) {
  const { info, setInfo } = useLiveSync(onSynced);
  const [key, setKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState('');

  async function act(action: 'create-key' | 'revoke-key') {
    setErr('');
    if (action === 'create-key' && info?.hasKey && !confirm('Make a new sync key? The computer using the old key will stop syncing until you set it up with the new one.')) return;
    if (action === 'revoke-key' && !confirm('Stop live sync? The sync program will be refused until you make a new key.')) return;
    try {
      const r = await syncCall(action);
      setKey(r.key || '');
      setInfo(await syncCall());
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed.'); }
  }

  const online = isOnline(info);
  return (
    <div className="tp-sync">
      <h2>Live sync from Tally</h2>
      <p className="tp-muted">
        {info?.lastSyncAt
          ? <>Last synced <strong>{minutesAgo(info.lastSyncAt)}</strong> from <strong>{info.computer}</strong>. The sync program is <strong className={online ? 'tp-ok' : 'tp-error'}>{online ? 'running' : 'not running'}</strong>{info.lastSeenAt && !online ? ` (last seen ${minutesAgo(info.lastSeenAt)})` : ''}.</>
          : info?.hasKey ? 'A sync key exists, but nothing has synced yet. Start the sync program on the Tally computer.'
          : 'A small program on the Tally computer reads Tally every minute and sends changes here. It only reads — it can never change your books. Make a sync key to connect it.'}
      </p>
      {key && (
        <div className="tp-key">
          <p><strong>Your sync key</strong> — copy it now, it won’t be shown again:</p>
          <code>{key}</code>
          <button className="btn-ghost" onClick={async () => { await navigator.clipboard.writeText(key).catch(() => {}); setCopied(true); }}>{copied ? 'Copied' : 'Copy key'}</button>
          <p className="tp-dim">On the Tally computer run <code>node tally-sync.mjs setup</code> and paste it when asked.</p>
        </div>
      )}
      {err && <p className="tp-error">{err}</p>}
      <div className="tp-sync-actions">
        <button className="btn" onClick={() => act('create-key')}>{info?.hasKey ? 'Make a new sync key' : 'Make a sync key'}</button>
        {info?.hasKey && <button className="btn-ghost" onClick={() => act('revoke-key')}>Stop live sync</button>}
      </div>
    </div>
  );
}

export function UploadBox({ onDone, compact }: { onDone: () => void; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function upload(file: File) {
    setBusy(true); setMsg(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/admin/tally/upload', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Upload failed.');
      const c = json.counts;
      setMsg({ ok: true, text: `Loaded ${c.parties} parties, ${c.sales + c.purchases} item lines, ${c.vouchers} entries and ${c.stock} stock items.` });
      onDone();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Upload failed.' });
    } finally { setBusy(false); }
  }

  return (
    <div className={`tp-upload${compact ? ' compact' : ''}`}>
      <label className="btn tp-upload-btn">
        {busy ? 'Reading the file…' : compact ? 'Upload a newer Tally Excel' : 'Choose the Tally Excel file'}
        <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
      </label>
      {msg && <p className={msg.ok ? 'tp-ok' : 'tp-error'} role="status">{msg.text}</p>}
    </div>
  );
}

export async function changePassword(current: string, next: string) {
  await post({ action: 'change', password: current, newPassword: next });
}
