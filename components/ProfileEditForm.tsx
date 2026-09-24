'use client';

import { useState } from 'react';
import { DEALS_IN_OPTIONS } from './ProfileCompletionForm';
import PreferencesEditor, { completePreferences, useCategoryList } from './PreferencesEditor';
import type { OrderPreference } from '@/lib/customer-preferences';

type Customer = {
  name: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  email_verified: boolean;
  work_stream: string | null;
  go_to_requirements: string | null;
  order_preferences?: OrderPreference[] | null;
};

// Everything filled in at sign-up, editable again here -- except the phone
// number, which is the login identity and stays read-only.
export default function ProfileEditForm({ customer }: { customer: Customer }) {
  const [name, setName] = useState(customer.name || '');
  const [company, setCompany] = useState(customer.company || '');
  const [dealsIn, setDealsIn] = useState<string[]>(
    customer.work_stream ? customer.work_stream.split(',').map((s) => s.trim()).filter(Boolean) : []
  );
  const [goToRequirements, setGoToRequirements] = useState(customer.go_to_requirements || '');
  const [email, setEmail] = useState(customer.email || '');
  const [preferences, setPreferences] = useState<OrderPreference[]>(customer.order_preferences || []);
  const categories = useCategoryList();
  const emailLocked = !!customer.email;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  function toggleDealsIn(option: string) {
    setDealsIn((prev) => (prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() && !company.trim()) {
      setError('Enter your name or your company name.');
      setSaved(false);
      return;
    }
    setError('');
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/account/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, company, dealsIn, goToRequirements, orderPreferences: completePreferences(preferences), email: emailLocked ? undefined : email })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save. Please try again.');
      setSaved(true);
    } catch (err: any) {
      setError(err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ maxWidth: 520, padding: 24 }}>
      <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>Your name</label>
      <input type="text" placeholder="e.g. Rajesh Kumar" value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 14 }} />

      <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>Company name</label>
      <input type="text" placeholder="e.g. Kumar Gems Pvt Ltd" value={company} onChange={(e) => setCompany(e.target.value)} style={{ marginBottom: 14 }} />

      <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>WhatsApp number</label>
      <input type="tel" value={customer.phone || ''} disabled readOnly style={{ marginBottom: 4, background: '#f1ede2', color: '#756e5c' }} />
      <p style={{ fontSize: 11.5, color: '#756e5c', margin: '0 0 14px' }}>Your phone number is how you sign in, so it can&rsquo;t be changed here. Contact us on WhatsApp if it needs to change.</p>

      <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>What do you deal in?</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {DEALS_IN_OPTIONS.map((option) => (
          <label key={option} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--ink)', cursor: 'pointer' }}>
            <input type="checkbox" className="icon-select-checkbox" checked={dealsIn.includes(option)} onChange={() => toggleDealsIn(option)} style={{ pointerEvents: 'auto' }} />
            {option}
          </label>
        ))}
      </div>

      <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>Your go-to requirements</label>
      <textarea rows={3} placeholder="e.g. Round white CZ 1-3mm, regular monthly" value={goToRequirements} onChange={(e) => setGoToRequirements(e.target.value)} style={{ marginBottom: 14 }} />

      <label className="po-label" style={{ marginBottom: 4, display: 'block' }}>Your usual picks</label>
      <p style={{ fontSize: 12, color: '#756e5c', margin: '0 0 8px' }}>When you order by colour alone, we&rsquo;ll use these. E.g. Red &rarr; Ruby Corundum, 5A.</p>
      <div style={{ marginBottom: 14 }}>
        <PreferencesEditor categories={categories} value={preferences} onChange={setPreferences} />
      </div>

      <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>Email {emailLocked ? '' : '(optional)'}</label>
      <input
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={emailLocked}
        readOnly={emailLocked}
        style={emailLocked ? { marginBottom: 14, background: '#f1ede2', color: '#756e5c' } : { marginBottom: 14 }}
      />

      {error && <p style={{ color: '#a3341f', fontSize: 12.5, marginBottom: 10 }}>{error}</p>}
      {saved && !error && <p style={{ color: '#2f6b3a', fontSize: 12.5, marginBottom: 10 }}>Saved.</p>}
      <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
    </form>
  );
}
