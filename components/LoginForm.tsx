'use client';

import { useState } from 'react';
import ProfileCompletionForm from './ProfileCompletionForm';

type Mode = 'phone' | 'email';
type Step = 'enter' | 'verify' | 'profile';

export default function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<Mode>('phone');
  const [step, setStep] = useState<Step>('enter');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [emailToken, setEmailToken] = useState('');
  const [devDisplay, setDevDisplay] = useState<string | null>(null);
  const [needsName, setNeedsName] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  function resetToEnter() {
    setStep('enter');
    setCode('');
    setEmailToken('');
    setDevDisplay(null);
    setError('');
  }

  function finishVerify() {
    setStep(needsName ? 'profile' : 'enter');
    if (!needsName) onSuccess();
  }

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSending(true);

    if (mode === 'phone') {
      const res = await fetch('/api/account/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json().catch(() => ({}));
      setSending(false);
      if (res.ok) {
        // data.code is only present when real WhatsApp delivery didn't happen/succeed --
        // a fallback for outages, not a shortcut around verification. Never auto-fill the
        // input: the customer must read the code off WhatsApp and type it in themselves.
        setDevDisplay(data.code || null);
        setNeedsName(!!data.needsName);
        setStep('verify');
      } else {
        setError(data.error || 'Failed to send code. Please try again.');
      }
    } else {
      const res = await fetch('/api/account/email/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json().catch(() => ({}));
      setSending(false);
      if (res.ok) {
        setDevDisplay(data.link);
        setEmailToken(data.token);
        setNeedsName(!!data.needsName);
        setStep('verify');
      } else {
        setError(data.error || 'Failed to send link. Please try again.');
      }
    }
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
    if (res.ok) {
      finishVerify();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Invalid code. Please try again.');
    }
  }

  async function verifyEmail() {
    setError('');
    setSending(true);
    const res = await fetch('/api/account/email/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: emailToken })
    });
    setSending(false);
    if (res.ok) {
      finishVerify();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Invalid or expired link.');
    }
  }

  return (
    <div>
      {step !== 'profile' && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => { setMode('phone'); resetToEnter(); }}
            style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, cursor: 'pointer', color: mode === 'phone' ? 'var(--navy)' : '#756e5c', fontWeight: mode === 'phone' ? 600 : 400, borderBottom: mode === 'phone' ? '2px solid var(--gold)' : '2px solid transparent', paddingBottom: 4 }}
          >
            Phone
          </button>
          <button
            type="button"
            onClick={() => { setMode('email'); resetToEnter(); }}
            style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, cursor: 'pointer', color: mode === 'email' ? 'var(--navy)' : '#756e5c', fontWeight: mode === 'email' ? 600 : 400, borderBottom: mode === 'email' ? '2px solid var(--gold)' : '2px solid transparent', paddingBottom: 4 }}
          >
            Email
          </button>
        </div>
      )}

      {step === 'enter' && (
        <form onSubmit={requestCode}>
          {mode === 'phone' ? (
            <input type="tel" placeholder="e.g. 9XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus style={{ marginBottom: 14 }} />
          ) : (
            <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus style={{ marginBottom: 14 }} />
          )}
          {error && <p style={{ color: '#a3341f', fontSize: 12.5, marginBottom: 10 }}>{error}</p>}
          <button type="submit" className="btn" style={{ width: '100%' }} disabled={sending}>
            {sending ? 'Sending…' : mode === 'phone' ? 'Get code' : 'Get link'}
          </button>
        </form>
      )}

      {step === 'verify' && mode === 'phone' && (
        <form onSubmit={verifyPhone}>
          {devDisplay && (
            <p style={{ fontSize: 12.5, background: '#f4e6d0', color: '#8a5a1f', padding: '8px 10px', marginBottom: 14, borderRadius: 4 }}>
              WhatsApp delivery didn't go through this time. Your code: <strong>{devDisplay}</strong> -- enter it below.
            </p>
          )}
          <input
            type="text"
            inputMode="numeric"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={{ marginBottom: 14, letterSpacing: 4, textAlign: 'center', fontSize: 18 }}
          />
          {error && <p style={{ color: '#a3341f', fontSize: 12.5, marginBottom: 10 }}>{error}</p>}
          <button type="submit" className="btn" style={{ width: '100%' }} disabled={sending || code.length !== 6}>
            {sending ? 'Verifying…' : 'Verify & log in'}
          </button>
          <button type="button" className="btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={resetToEnter}>
            &larr; Use a different number
          </button>
        </form>
      )}

      {step === 'verify' && mode === 'email' && (
        <div>
          {devDisplay && (
            <p style={{ fontSize: 12.5, background: '#f4e6d0', color: '#8a5a1f', padding: '8px 10px', marginBottom: 14, borderRadius: 4, wordBreak: 'break-all' }}>
              Your login link: <a href={devDisplay} onClick={(e) => e.preventDefault()}>{devDisplay}</a>
              <br />(No email provider is wired up yet -- tap "Verify" below instead of the link.)
            </p>
          )}
          {error && <p style={{ color: '#a3341f', fontSize: 12.5, marginBottom: 10 }}>{error}</p>}
          <button type="button" className="btn" style={{ width: '100%' }} onClick={verifyEmail} disabled={sending}>
            {sending ? 'Verifying…' : 'Verify & log in'}
          </button>
          <button type="button" className="btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={resetToEnter}>
            &larr; Use a different email
          </button>
        </div>
      )}

      {step === 'profile' && <ProfileCompletionForm onSuccess={onSuccess} />}
    </div>
  );
}
