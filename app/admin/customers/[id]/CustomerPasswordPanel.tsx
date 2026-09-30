'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Status = { hasPassword: boolean; setAt: string | null; setBy: 'admin' | 'customer' | null };

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

function suggest() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

// Sign-in password for one customer: see it, copy it, set a new one. The
// password is fetched only when Show is pressed, never sent with the page.
export default function CustomerPasswordPanel({ customerId, phone, status }: { customerId: number; phone: string | null; status: Status }) {
  const router = useRouter();
  const [shown, setShown] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function show() {
    if (shown !== null) return setShown(null);
    setBusy(true); setMessage('');
    const res = await fetch(`/api/admin/customers/${customerId}/password`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMessage(data.error || 'Could not load the password.');
    if (!data.viewable) return setMessage('This password was saved before the viewing key changed, so it can’t be shown. Set a new one below.');
    setShown(data.password);
  }

  async function save() {
    setBusy(true); setMessage('');
    const res = await fetch(`/api/admin/customers/${customerId}/password`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: draft })
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMessage(data.error || 'Could not save the password.');
    setShown(draft); setDraft('');
    setMessage('Password saved. Send it to the customer on WhatsApp; they can change it from My Info.');
    router.refresh();
  }

  async function copy() {
    if (shown === null) return;
    try { await navigator.clipboard.writeText(shown); setMessage('Copied.'); } catch { setMessage('Copy failed -- select the password and copy it.'); }
  }

  return <section className="card admin-profile-editor" aria-labelledby="pw-heading">
    <h2 id="pw-heading">Sign-in password</h2>
    {!phone ? (
      <p className="login-hint">Add a WhatsApp number above first -- customers sign in with their number and password.</p>
    ) : (
      <>
        <p className="login-hint" style={{ marginBottom: 14 }}>
          {status.hasPassword && status.setAt
            ? <>Signs in with <strong>{phone}</strong> and a password, set by {status.setBy === 'admin' ? 'the team' : 'the customer'} on {when(status.setAt)}. They can also use a WhatsApp code.</>
            : <>No password yet -- they sign in with a WhatsApp code. Set one below to let them use <strong>{phone}</strong> and a password.</>}
        </p>
        {status.hasPassword && (
          <div className="admin-password-row">
            <code className="admin-password-value" aria-live="polite">{shown ?? '••••••••'}</code>
            <button type="button" className="btn-ghost" onClick={show} disabled={busy}>{shown === null ? 'Show' : 'Hide'}</button>
            {shown !== null && <button type="button" className="btn-ghost" onClick={copy}>Copy</button>}
          </div>
        )}
        <div className="admin-profile-grid" style={{ marginTop: 14 }}>
          <label>{status.hasPassword ? 'New password' : 'Password'}
            <input type="text" autoComplete="off" spellCheck={false} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="At least 4 characters" />
          </label>
        </div>
        <div className="admin-form-actions">
          <button type="button" className="btn" onClick={save} disabled={busy || draft.length < 4}>{busy ? 'Saving…' : status.hasPassword ? 'Set new password' : 'Set password'}</button>
          <button type="button" className="btn-ghost" onClick={() => setDraft(suggest())} disabled={busy}>Suggest one</button>
        </div>
      </>
    )}
    {message && <p role="status" className="admin-inline-status">{message}</p>}
  </section>;
}
