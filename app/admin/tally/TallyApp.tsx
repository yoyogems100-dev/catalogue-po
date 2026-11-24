'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

  const fetchData = useCallback(async () => {
    setLoad({ state: 'loading' });
    try {
      const res = await fetch('/api/admin/tally/data', { cache: 'no-store' });
      if (res.status === 401) { onLocked(); return; }
      if (res.status === 404) { setLoad({ state: 'empty' }); return; }
      if (!res.ok) throw new Error(`The data could not be loaded (${res.status}).`);
      setLoad({ state: 'ready', data: await res.json() });
    } catch (e) {
      setLoad({ state: 'error', message: e instanceof Error ? e.message : 'The data could not be loaded.' });
    }
  }, [onLocked]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const ix = useMemo(() => (load.state === 'ready' ? buildIndex(load.data) : null), [load]);

  async function lock() {
    await post({ action: 'logout' }).catch(() => {});
    onLocked();
  }

  if (load.state === 'loading') return <div className="tp-loading"><span className="tp-spinner" aria-hidden /> Opening your Tally data…</div>;
  if (load.state === 'error') return <div className="tp-loading"><p className="tp-error">{load.message}</p><button className="btn" onClick={fetchData}>Try again</button></div>;
  if (load.state === 'empty') {
    return (
      <div className="tp-empty">
        <h1>Tally accounts</h1>
        <p>No Tally data yet. Upload the Excel extract from Tally (the workbook with Parties, Sales, Purchases, Vouchers and Stock Items sheets).</p>
        <UploadBox onDone={fetchData} />
        <button className="tp-link" onClick={lock}>Lock</button>
      </div>
    );
  }
  return <TallyPortal ix={ix!} onReload={fetchData} onLock={lock} />;
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
