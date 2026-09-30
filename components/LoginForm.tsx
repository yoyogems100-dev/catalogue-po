'use client';

import { useState } from 'react';
import { DEALS_IN_OPTIONS } from './ProfileCompletionForm';

type Tab = 'login' | 'signup';

// Trial phase (owner, 2026-09-30): WhatsApp codes aren't being delivered, so
// Log in is WhatsApp number + a PIN the team sets in admin, and Sign up only
// sends a request for access, which shows on the admin overview. The owner
// tells buyers the rest directly, so the form carries no explanations.
export default function LoginForm({ onSuccess, initialTab = 'login', autoFocus = true }: {
  onSuccess: () => void;
  initialTab?: Tab;
  /** Off where the form sits below other content (the cart): focusing it
   *  jumped the page to the bottom and opened the phone keyboard over the list. */
  autoFocus?: boolean;
  /** @deprecated email login isn't offered; kept so existing callers compile. */
  phoneOnly?: boolean;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [requested, setRequested] = useState(false);

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [dealsIn, setDealsIn] = useState<string[]>([]);
  const [goToRequirements, setGoToRequirements] = useState('');
  const [email, setEmail] = useState('');

  function toggleDealsIn(option: string) {
    setDealsIn((prev) => (prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]));
  }

  function switchTab(next: Tab) {
    setTab(next);
    setError('');
    setPin('');
    setRequested(false);
  }

  async function logIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSending(true);
    const res = await fetch('/api/account/password/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password: pin })
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) return setError(data.error || 'Could not log in. Please try again.');
    onSuccess();
  }

  async function requestAccess(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() && !company.trim()) return setError('Enter your name or your company name.');
    setError('');
    setSending(true);
    const res = await fetch('/api/account/access-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, company, phone, dealsIn, goToRequirements, email })
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) return setError(data.error || 'Could not send your request. Please try again.');
    setRequested(true);
  }

  const signup = tab === 'signup';

  return (
    <div>
      <div className="login-mode-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={!signup} onClick={() => switchTab('login')} className={`login-mode-tab${!signup ? ' active' : ''}`}>Log in</button>
        <button type="button" role="tab" aria-selected={signup} onClick={() => switchTab('signup')} className={`login-mode-tab${signup ? ' active' : ''}`}>Sign up</button>
      </div>

      {!signup && (
        <form onSubmit={logIn}>
          <label className="po-label" htmlFor="login-phone" style={{ marginBottom: 6, display: 'block' }}>WhatsApp number</label>
          <input id="login-phone" name="username" type="tel" inputMode="tel" autoComplete="username" placeholder="e.g. 9XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus={autoFocus} style={{ marginBottom: 12 }} required />
          <label className="po-label" htmlFor="login-pin" style={{ marginBottom: 6, display: 'block' }}>PIN</label>
          <div className="login-password-field" style={{ marginBottom: 14 }}>
            <input id="login-pin" name="password" type={showPin ? 'text' : 'password'} autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} required />
            <button type="button" className="login-password-toggle" onClick={() => setShowPin((v) => !v)} aria-pressed={showPin}>{showPin ? 'Hide' : 'Show'}</button>
          </div>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="btn" style={{ width: '100%' }} disabled={sending}>{sending ? 'Logging in…' : 'Log in'}</button>
        </form>
      )}

      {signup && requested && (
        <p className="login-hint" role="status"><strong>Request sent.</strong></p>
      )}

      {signup && !requested && (
        <form onSubmit={requestAccess}>
          <label className="po-label" htmlFor="signup-name" style={{ marginBottom: 6, display: 'block' }}>Your name</label>
          <input id="signup-name" type="text" placeholder="e.g. Rajesh Kumar" value={name} onChange={(e) => setName(e.target.value)} autoFocus={autoFocus} style={{ marginBottom: 12 }} />

          <label className="po-label" htmlFor="signup-company" style={{ marginBottom: 6, display: 'block' }}>Company name</label>
          <input id="signup-company" type="text" placeholder="e.g. Kumar Gems Pvt Ltd" value={company} onChange={(e) => setCompany(e.target.value)} style={{ marginBottom: 12 }} />

          <label className="po-label" htmlFor="signup-phone" style={{ marginBottom: 6, display: 'block' }}>WhatsApp number</label>
          <input id="signup-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="e.g. 9XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ marginBottom: 12 }} required />

          {/* Optional, so folded away: on a phone these six checkboxes, a
              text box and email made sign-up a long scroll before the one
              button that matters. */}
          <details className="login-more" style={{ marginBottom: 14 }}>
            <summary>Add more details (optional)</summary>
            <label className="po-label" style={{ marginBottom: 6, marginTop: 10, display: 'block' }}>What do you deal in?</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {DEALS_IN_OPTIONS.map((option) => (
                <label key={option} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--ink)', cursor: 'pointer' }}>
                  <input type="checkbox" className="icon-select-checkbox" checked={dealsIn.includes(option)} onChange={() => toggleDealsIn(option)} style={{ pointerEvents: 'auto' }} />
                  {option}
                </label>
              ))}
            </div>

            <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>Your go-to requirements</label>
            <textarea rows={2} placeholder="e.g. Round white CZ 1-3mm, regular monthly" value={goToRequirements} onChange={(e) => setGoToRequirements(e.target.value)} style={{ marginBottom: 12 }} />

            <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>Email</label>
            <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </details>

          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="btn" style={{ width: '100%' }} disabled={sending}>{sending ? 'Sending…' : 'Request access'}</button>
        </form>
      )}
    </div>
  );
}
