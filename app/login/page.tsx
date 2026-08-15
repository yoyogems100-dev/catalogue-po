'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FullLogo } from '@/components/Logo';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (res.ok) {
      router.push('/admin');
      router.refresh();
    } else {
      setError('Incorrect password.');
    }
  }

  return (
    <div className="login-box card">
      <div style={{ marginBottom: 20 }}><FullLogo size="md" color="#1B3A6B" /></div>
      <form onSubmit={submit}>
        <input
          type="password"
          placeholder="Admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <p style={{ color: '#a3341f', fontSize: 12.5, marginTop: 8 }}>{error}</p>}
        <button type="submit" className="btn" style={{ marginTop: 14, width: '100%' }}>Log in</button>
      </form>
    </div>
  );
}
