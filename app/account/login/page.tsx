'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FullLogo } from '@/components/Logo';

export default function CustomerLoginPage() {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [needsName, setNeedsName] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [displayCode, setDisplayCode] = useState<string | null>(null);
  const router = useRouter();

  async function requestOtp(e: React.FormEvent) {
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
    if (res.ok) {
      setStep('code');
      setDisplayCode(data.code);
      setCode(data.code);
      setNeedsName(!!data.needsName);
    } else {
      setError(data.error || 'Failed to send code. Please try again.');
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSending(true);
    const res = await fetch('/api/account/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code, name: needsName ? name : undefined })
    });
    setSending(false);
    if (res.ok) {
      router.push('/account/orders');
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Invalid code. Please try again.');
    }
  }

  return (
    <div className="login-box card">
      <div style={{ marginBottom: 20 }}><FullLogo size="md" color="#1B3A6B" /></div>

      {step === 'phone' ? (
        <form onSubmit={requestOtp}>
          <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>Phone number</label>
          <input
            type="tel"
            placeholder="e.g. 9XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoFocus
            style={{ marginBottom: 14 }}
          />
          {error && <p style={{ color: '#a3341f', fontSize: 12.5, marginBottom: 10 }}>{error}</p>}
          <button type="submit" className="btn" style={{ width: '100%' }} disabled={sending}>
            {sending ? 'Sending…' : 'Get code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOtp}>
          {displayCode && (
            <p style={{ fontSize: 12.5, background: '#f4e6d0', color: '#8a5a1f', padding: '8px 10px', marginBottom: 14, borderRadius: 4 }}>
              Your verification code: <strong>{displayCode}</strong> (pre-filled below).
            </p>
          )}
          {needsName && (
            <>
              <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>Your name</label>
              <input
                type="text"
                placeholder="e.g. Rajesh Kumar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ marginBottom: 14 }}
              />
            </>
          )}
          <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>6-digit code</label>
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
          <button
            type="button"
            className="btn-ghost"
            style={{ width: '100%', marginTop: 8 }}
            onClick={() => { setStep('phone'); setCode(''); setError(''); setDisplayCode(null); }}
          >
            &larr; Use a different number
          </button>
        </form>
      )}
    </div>
  );
}
