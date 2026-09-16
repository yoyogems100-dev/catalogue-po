'use client';

import { useState } from 'react';

const DEALS_IN_OPTIONS = ['Gold Jewellery Manufacturer', 'Silver Jewellery Manufacturer', 'Retailer', 'Wholesaler', 'Exporter', 'Commercial'];

export default function ProfileCompletionForm({
  onSuccess,
  needsPhone = false,
  showEmail = true
}: {
  onSuccess: () => void;
  needsPhone?: boolean;
  showEmail?: boolean;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [dealsIn, setDealsIn] = useState<string[]>([]);
  const [goToRequirements, setGoToRequirements] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggleDealsIn(option: string) {
    setDealsIn((prev) => (prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() && !company.trim()) {
      setError('Enter your name or your company name.');
      return;
    }
    if (needsPhone && phone.replace(/\D/g, '').length < 10) {
      setError('Enter a valid phone number.');
      return;
    }
    setError('');
    setSaving(true);
    const res = await fetch('/api/account/profile/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone: needsPhone ? phone : undefined, company, dealsIn, goToRequirements, email: showEmail ? email : undefined })
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
        Just once -- tell us who you are so we can find your orders next time. Your name or your company name is enough to continue.
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
      {needsPhone && (
        <>
          <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>Phone number</label>
          <input
            type="tel"
            placeholder="e.g. 9XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ marginBottom: 12 }}
          />
        </>
      )}
      <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>Company name</label>
      <input
        type="text"
        placeholder="e.g. Kumar Gems Pvt Ltd"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>What do you deal in? (optional)</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {DEALS_IN_OPTIONS.map((option) => (
          <label key={option} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--ink)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              className="icon-select-checkbox"
              checked={dealsIn.includes(option)}
              onChange={() => toggleDealsIn(option)}
              style={{ pointerEvents: 'auto' }}
            />
            {option}
          </label>
        ))}
      </div>
      <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>Your go-to requirements (optional)</label>
      <textarea
        rows={2}
        placeholder="e.g. Round white CZ 1-3mm, regular monthly"
        value={goToRequirements}
        onChange={(e) => setGoToRequirements(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      {showEmail && (
        <>
          <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>Email (optional)</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ marginBottom: 14 }}
          />
        </>
      )}
      {error && <p style={{ color: '#a3341f', fontSize: 12.5, marginBottom: 10 }}>{error}</p>}
      <button type="submit" className="btn" style={{ width: '100%' }} disabled={saving}>
        {saving ? 'Saving…' : 'Continue'}
      </button>
    </form>
  );
}
