'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ColourSetupEditor from '@/components/admin/ColourSetupEditor';
import { completePreferences } from '@/components/PreferencesEditor';
import type { OrderPreference } from '@/lib/customer-preferences';

export default function CustomerColourSetup({ customerId, categories, initialButtons, initialPicks, shopButtons, shopPicks }: {
  customerId: number;
  categories: { id: number; name: string; slug: string | null }[];
  initialButtons: number[] | null;
  initialPicks: OrderPreference[];
  shopButtons: number[];
  shopPicks: OrderPreference[];
}) {
  const router = useRouter();
  const [value, setValue] = useState({ buttons: initialButtons, picks: initialPicks });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function save() {
    setSaving(true); setMessage('');
    const res = await fetch(`/api/admin/customers/${customerId}/colours`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ colorButtons: value.buttons, orderPreferences: completePreferences(value.picks) })
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setMessage(data.error || 'Could not save.');
    setDirty(false); setMessage('Saved. This buyer sees it the next time they open the site.'); router.refresh();
  }

  return <section className="card admin-profile-editor">
    <h2>Colour buttons &amp; picks</h2>
    <p style={{ fontSize: 12.5, color: '#756e5c', margin: '0 0 12px' }}>
      Which colour buttons this buyer sees and the stone each opens for them. Anything left on the shop setting follows
      Catalogue map → Colour buttons, including later changes there.
    </p>
    <ColourSetupEditor
      mode="buyer"
      categories={categories}
      buttons={value.buttons}
      picks={value.picks}
      shopButtons={shopButtons}
      shopPicks={shopPicks}
      onChange={(next) => { setValue(next); setDirty(true); setMessage(''); }}
    />
    <div className="admin-form-actions"><button className="btn" type="button" onClick={save} disabled={saving || !dirty}>{saving ? 'Saving…' : dirty ? 'Save for this buyer' : 'Saved'}</button>{message && <span role="status">{message}</span>}</div>
  </section>;
}
