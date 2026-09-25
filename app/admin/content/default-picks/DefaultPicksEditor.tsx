'use client';

import { useState } from 'react';
import PreferencesEditor, { completePreferences } from '@/components/PreferencesEditor';
import { DEFAULT_PICKS_SETTING_KEY, type OrderPreference } from '@/lib/customer-preferences';

export default function DefaultPicksEditor({ categories, initial }: { categories: { id: number; name: string }[]; initial: OrderPreference[] }) {
  const [picks, setPicks] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  async function save() {
    setSaving(true);
    setStatus('');
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: DEFAULT_PICKS_SETTING_KEY, value: JSON.stringify(completePreferences(picks)) })
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    setStatus(res.ok ? 'Saved. Buyers get these the next time they open the site.' : `Could not save: ${data.error || res.status}`);
  }

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <PreferencesEditor categories={categories} value={picks} onChange={(next) => { setPicks(next); setStatus(''); }} />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
        <button type="button" className="btn" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save defaults'}</button>
        {status && <span role="status" style={{ fontSize: 13 }}>{status}</span>}
      </div>
    </div>
  );
}
