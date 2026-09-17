'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CUSTOMER_PLACES } from '@/lib/customer-places';

// Adding a customer from the directory, for the common case where an enquiry
// arrives by phone before the buyer has signed in themselves. Mirrors the
// supplier create form; name OR company satisfies the requirement, matching
// the rule the customer-facing profile form already uses.
export default function CustomerCreateForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [place, setPlace] = useState('');
  const [workStream, setWorkStream] = useState('');
  const [goToRequirements, setGoToRequirements] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function create() {
    if (!name.trim() && !company.trim()) return setMessage('Enter a name or a company.');
    setSaving(true);
    setMessage('');
    const response = await fetch('/api/admin/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, company, phone, place, workStream, goToRequirements })
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) return setMessage(data.error || 'Could not create customer.');
    router.push(`/admin/customers/${data.id}`);
  }

  if (!open) return <button className="btn" type="button" onClick={() => setOpen(true)}>+ Add customer</button>;

  return (
    <div className="card admin-inline-create" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, maxWidth: 480 }}>
      <input autoFocus placeholder="Customer name" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Company (optional)" value={company} onChange={(e) => setCompany(e.target.value)} />
      <input placeholder="WhatsApp number (optional)" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <div>
        <label style={{ display: 'block', fontSize: 12.5, marginBottom: 4 }}>Place</label>
        <select value={place} onChange={(e) => setPlace(e.target.value)}>
          <option value="">Not set</option>
          {CUSTOMER_PLACES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <input placeholder="Work stream, e.g. Silver Jewellery Manufacturer" value={workStream} onChange={(e) => setWorkStream(e.target.value)} />
      <textarea rows={2} placeholder="Go-to requirements (optional)" value={goToRequirements} onChange={(e) => setGoToRequirements(e.target.value)} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn" onClick={create} disabled={saving}>{saving ? 'Adding…' : 'Add customer'}</button>
        <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        {message && <span role="status">{message}</span>}
      </div>
    </div>
  );
}
