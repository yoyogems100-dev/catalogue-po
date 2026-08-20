'use client';

import { useState } from 'react';

export default function ProfileCompletionForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setError('');
    setSaving(true);
    const res = await fetch('/api/account/profile/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, company })
    });
    setSaving(false);
    if (res.ok) {
      onSuccess();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Failed to save. Please try again.');
    }
  }

  return (
    <form onSubmit={submit}>
      <p style={{ fontSize: 12.5, color: '#756e5c', marginBottom: 14 }}>
        Just once -- tell us who you are so we can find your orders next time.
      </p>
      <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>Your name</label>
      <input
        type="text"
        placeholder="e.g. Rajesh Kumar"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        style={{ marginBottom: 12 }}
      />
      <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>Company (optional)</label>
      <input
        type="text"
        placeholder="e.g. Kumar Gems Pvt Ltd"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        style={{ marginBottom: 14 }}
      />
      {error && <p style={{ color: '#a3341f', fontSize: 12.5, marginBottom: 10 }}>{error}</p>}
      <button type="submit" className="btn" style={{ width: '100%' }} disabled={saving}>
        {saving ? 'Saving…' : 'Continue'}
      </button>
    </form>
  );
}
