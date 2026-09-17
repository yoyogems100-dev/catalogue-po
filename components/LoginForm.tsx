'use client';

import { useState } from 'react';
import ProfileCompletionForm from './ProfileCompletionForm';

type Tab = 'login' | 'signup';
type Step = 'enter' | 'verify' | 'profile';

// Log in and Sign up both verify the WhatsApp number with a one-time code --
// there are no passwords. Sign up then asks for the buyer's details (name or
// company, what they deal in, go-to requirements). The server decides who is
// actually new: a new number on "Log in" still gets the details step, and an
// existing number on "Sign up" is simply logged in.
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
    setSending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return setError(data.error || 'Invalid code. Please try again.');
    }
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
            {signup ? 'Step 1 of 2 — verify your WhatsApp number. Next, tell us about your business.' : 'Enter your WhatsApp number. We’ll send a one-time code.'}
          </p>
          <input type="tel" inputMode="tel" autoComplete="tel" placeholder="WhatsApp number, e.g. 9XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus style={{ marginBottom: 14 }} />
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
          <p className="login-hint"><strong>Step 2 of 2 — your details</strong></p>
          <ProfileCompletionForm onSuccess={onSuccess} needsPhone={false} showEmail />
        </>
      )}
    </div>
  );
}
