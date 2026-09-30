'use client';

import { useState } from 'react';

// My Info > Password. Someone who signed in with a WhatsApp code and never
// had a password just sets one; changing an existing one needs the current
// password (forgotten it? the Forgot password link on the sign-in page).
export default function PasswordSettings({ phone, hasPassword: initial }: { phone: string | null; hasPassword: boolean }) {
  const [hasPassword, setHasPassword] = useState(initial);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMessage(null);
    const res = await fetch('/api/account/password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current, password: next })
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setMessage({ ok: false, text: data.error || 'Could not save your password.' });
    setHasPassword(true); setCurrent(''); setNext('');
    setMessage({ ok: true, text: `Saved. Next time, log in with ${phone || 'your number'} and this password.` });
  }

  return (
    <section className="card" style={{ padding: 20, marginTop: 20, maxWidth: 560 }} aria-labelledby="pw-settings">
      <h2 id="pw-settings" style={{ fontSize: 18, color: 'var(--ink)', margin: '0 0 6px' }}>Password</h2>
      <p className="login-hint">
        {hasPassword ? 'Change the password you log in with.' : 'Set a password to log in with your number and password instead of waiting for a WhatsApp code.'}
      </p>
      <form onSubmit={save}>
        <input type="hidden" name="username" autoComplete="username" value={phone || ''} />
        {hasPassword && (
          <>
            <label className="po-label" htmlFor="pw-current" style={{ marginBottom: 6, display: 'block' }}>Current password</label>
            <input id="pw-current" type={show ? 'text' : 'password'} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} style={{ marginBottom: 12 }} required />
          </>
        )}
        <label className="po-label" htmlFor="pw-new" style={{ marginBottom: 6, display: 'block' }}>{hasPassword ? 'New password' : 'Password'}</label>
        <div className="login-password-field" style={{ marginBottom: 12 }}>
          <input id="pw-new" type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 4 characters" value={next} onChange={(e) => setNext(e.target.value)} required />
          <button type="button" className="login-password-toggle" onClick={() => setShow((v) => !v)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
        </div>
        {message && <p className={message.ok ? 'login-hint' : 'login-error'} role="status">{message.text}</p>}
        <button type="submit" className="btn" disabled={saving || next.length < 4}>{saving ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}</button>
      </form>
    </section>
  );
}
