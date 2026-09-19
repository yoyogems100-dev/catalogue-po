'use client';

import { useState } from 'react';
import ProfileCompletionForm, { DEALS_IN_OPTIONS } from './ProfileCompletionForm';

type Tab = 'login' | 'signup';
type Step = 'enter' | 'verify' | 'profile';

// Log in and Sign up both verify the WhatsApp number with a one-time code --
// there are no passwords. Sign up collects every detail (name/company, what
// they deal in, go-to requirements, email) on the same screen as the phone
// number, like an ordinary sign-up form; the code is just the last step that
// activates it. The server still decides who is actually new: a new number
// on "Log in" falls back to a short details step after verifying, and an
// existing number on "Sign up" is simply logged in (its collected details
// are dropped since the account already has its own).
export default function LoginForm({ onSuccess, initialTab = 'login' }: {
  onSuccess: () => void;
  initialTab?: Tab;
  /** @deprecated email login isn't offered; kept so existing callers compile. */
  phoneOnly?: boolean;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [step, setStep] = useState<Step>('enter');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devDisplay, setDevDisplay] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);

  // Signup-only profile fields, collected up front alongside the phone number.
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [dealsIn, setDealsIn] = useState<string[]>([]);
  const [goToRequirements, setGoToRequirements] = useState('');
  const [email, setEmail] = useState('');

  function toggleDealsIn(option: string) {
    setDealsIn((prev) => (prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]));
  }

  function reset(nextTab: Tab = tab) {
    setTab(nextTab);
    setStep('enter');
    setCode('');
    setDevDisplay(null);
    setError('');
    setNotice('');
  }

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    if (tab === 'signup' && !name.trim() && !company.trim()) {
      setError('Enter your name or your company name.');
      return;
    }
    setError('');
    setSending(true);
    const res = await fetch('/api/account/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) return setError(data.error || 'Failed to send code. Please try again.');
    // data.code is only present when real WhatsApp delivery didn't happen in a
    // local test setup. Never auto-fill it.
    setDevDisplay(data.code || null);
    setNeedsProfile(!!data.needsName);
    if (tab === 'signup' && !data.needsName) setNotice('This number already has an account — verify the code to log in.');
    else if (tab === 'login' && data.needsName) setNotice("Looks like you're new here — verify the code, then add a few details.");
    else setNotice('');
    setStep('verify');
  }

  async function verifyPhone(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSending(true);
    const res = await fetch('/api/account/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code })
    });
    if (!res.ok) {
      setSending(false);
      const data = await res.json().catch(() => ({}));
      return setError(data.error || 'Invalid code. Please try again.');
    }
    // Signup already collected the profile fields -- save them now that the
    // number is verified and the account exists, instead of asking again.
    if (tab === 'signup' && needsProfile) {
      const saveRes = await fetch('/api/account/profile/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, company, dealsIn, goToRequirements, email })
      });
      setSending(false);
      if (!saveRes.ok) {
        // Verified and logged in already -- fall back to the standalone
        // details step instead of losing the session on a save failure.
        setStep('profile');
        return;
      }
      return onSuccess();
    }
    setSending(false);
    if (needsProfile) setStep('profile');
    else onSuccess();
  }

  const signup = tab === 'signup';

  return (
    <div>
      {step !== 'profile' && (
        <div className="login-mode-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={!signup} onClick={() => reset('login')} className={`login-mode-tab${!signup ? ' active' : ''}`}>Log in</button>
          <button type="button" role="tab" aria-selected={signup} onClick={() => reset('signup')} className={`login-mode-tab${signup ? ' active' : ''}`}>Sign up</button>
        </div>
      )}

      {step === 'enter' && (
        <form onSubmit={requestCode}>
          <p className="login-hint">
            {signup ? 'Just the essentials -- name or company, and a WhatsApp number to send your one-time code.' : 'Enter your WhatsApp number. We’ll send a one-time code.'}
          </p>

          {signup && (
            <>
              <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>Your name</label>
              <input type="text" placeholder="e.g. Rajesh Kumar" value={name} onChange={(e) => setName(e.target.value)} autoFocus style={{ marginBottom: 12 }} />

              <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>Company name</label>
              <input type="text" placeholder="e.g. Kumar Gems Pvt Ltd" value={company} onChange={(e) => setCompany(e.target.value)} style={{ marginBottom: 12 }} />
            </>
          )}

          <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>WhatsApp number</label>
          <input type="tel" inputMode="tel" autoComplete="tel" placeholder="WhatsApp number, e.g. 9XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus={!signup} style={{ marginBottom: signup ? 12 : 14 }} />

          {signup && (
            <>
              <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>What do you deal in? (optional)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {DEALS_IN_OPTIONS.map((option) => (
                  <label key={option} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--ink)', cursor: 'pointer' }}>
                    <input type="checkbox" className="icon-select-checkbox" checked={dealsIn.includes(option)} onChange={() => toggleDealsIn(option)} style={{ pointerEvents: 'auto' }} />
                    {option}
                  </label>
                ))}
              </div>

              <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>Your go-to requirements (optional)</label>
              <textarea rows={2} placeholder="e.g. Round white CZ 1-3mm, regular monthly" value={goToRequirements} onChange={(e) => setGoToRequirements(e.target.value)} style={{ marginBottom: 12 }} />

              <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>Email (optional)</label>
              <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: 14 }} />
            </>
          )}

          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="btn" style={{ width: '100%' }} disabled={sending}>
            {sending ? 'Sending…' : 'Get code on WhatsApp'}
          </button>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={verifyPhone}>
          {notice && <p className="login-hint">{notice}</p>}
          {devDisplay && (
            <p style={{ fontSize: 12.5, background: '#f4e6d0', color: '#8a5a1f', padding: '8px 10px', marginBottom: 14, borderRadius: 4 }}>
              WhatsApp delivery didn't go through this time. Your code: <strong>{devDisplay}</strong> — enter it below.
            </p>
          )}
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={{ marginBottom: 14, letterSpacing: 4, textAlign: 'center', fontSize: 18 }}
          />
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="btn" style={{ width: '100%' }} disabled={sending || code.length !== 6}>
            {sending ? 'Verifying…' : needsProfile ? 'Verify & continue' : 'Verify & log in'}
          </button>
          <button type="button" className="btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => reset()}>
            &larr; Use a different number
          </button>
        </form>
      )}

      {step === 'profile' && (
        <>
          <p className="login-hint"><strong>Just a couple more details</strong></p>
          <ProfileCompletionForm onSuccess={onSuccess} needsPhone={false} showEmail />
        </>
      )}
    </div>
  );
}
