'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FullLogo } from '@/components/Logo';

export default function CustomerLoginPage() {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const router = useRouter();

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSending(true);
    const res = await fetch('/api/account/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, channel })
    });
    setSending(false);
    if (res.ok) {
      setStep('code');
    } else {
      const data = await res.json().catch(() => ({}));
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
      body: JSON.stringify({ phone, code })
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
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="radio" name="channel" checked={channel === 'whatsapp'} onChange={() => setChannel('whatsapp')} />
              Get code via WhatsApp
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="radio" name="channel" checked={channel === 'sms'} onChange={() => setChannel('sms')} />
              Get code via SMS
            </label>
          </div>
          {error && <p style={{ color: '#a3341f', fontSize: 12.5, marginBottom: 10 }}>{error}</p>}
          <button type="submit" className="btn" style={{ width: '100%' }} disabled={sending}>
            {sending ? 'Sending…' : 'Send code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOtp}>
          <p style={{ fontSize: 12.5, color: '#8a8370', marginBottom: 14 }}>
            Enter the 6-digit code sent to {phone} via {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}.
          </p>
          <input
            type="text"
            inputMode="numeric"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoFocus
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
            onClick={() => { setStep('phone'); setCode(''); setError(''); }}
          >
            &larr; Use a different number
          </button>
        </form>
      )}
    </div>
  );
}
