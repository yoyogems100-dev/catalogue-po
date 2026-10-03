'use client';

import { useState } from 'react';

/** Lets this customer's own /po account switch to any buyer and order for them. */
export default function CustomerOrderForOthers({ customerId, initial }: { customerId: number; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function toggle(next: boolean) {
    setSaving(true);
    setError('');
    const res = await fetch(`/api/admin/customers/${customerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canOrderForOthers: next })
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) { setError((await res?.json().catch(() => null))?.error || 'Could not save. Please retry.'); return; }
    setOn(next);
  }

  return (
    <section className="card admin-order-for-others">
      <label>
        <input type="checkbox" checked={on} disabled={saving} onChange={(e) => toggle(e.target.checked)} />
        <span>
          <strong>Can order for other customers</strong>
          <small>In /po, their account menu gets &ldquo;Switch customer&rdquo;: they can pick any buyer, see the catalogue and orders as them, and place orders in that buyer&rsquo;s name. Each such order shows who entered it. Give this only to your own team.</small>
        </span>
      </label>
      {error && <p role="alert" style={{ color: '#b42318', fontSize: 13, margin: '8px 0 0' }}>{error}</p>}
    </section>
  );
}
