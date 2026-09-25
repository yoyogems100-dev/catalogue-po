'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CUSTOMER_PLACES } from '@/lib/customer-places';
import PreferencesEditor, { completePreferences } from '@/components/PreferencesEditor';
import type { OrderPreference } from '@/lib/customer-preferences';

type Customer = { id: number; name: string | null; company: string | null; phone: string | null; email: string | null; work_stream?: string | null; go_to_requirements?: string | null; place?: string | null; order_preferences?: OrderPreference[] | null };

export default function CustomerProfileEditor({ customer, categories }: { customer: Customer; categories: { id: number; name: string }[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: customer.name || '', company: customer.company || '', phone: customer.phone || '', email: customer.email || '', workStream: customer.work_stream || '', goToRequirements: customer.go_to_requirements || '', place: customer.place || '' });
  const [preferences, setPreferences] = useState<OrderPreference[]>(customer.order_preferences || []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  async function save() {
    setSaving(true); setMessage('');
    const response = await fetch(`/api/admin/customers/${customer.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, orderPreferences: completePreferences(preferences) }) });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) return setMessage(data.error || 'Could not save customer.');
    setMessage('Customer saved.'); router.refresh();
  }
  return <section className="card admin-profile-editor">
    <h2>Customer details</h2>
    <div className="admin-profile-grid">
      <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label>Company<input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} /></label>
      <label>WhatsApp number<input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
      <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label>Work stream<select value={form.workStream} onChange={(event) => setForm({ ...form, workStream: event.target.value })}><option value="">Choose work stream</option><option>Silver jewellery</option><option>Gold jewellery</option><option>Commercial jewellery</option><option>Fashion jewellery</option><option>Gemstone trader</option><option>Manufacturer</option><option>Retailer</option><option>Other</option></select></label>
      <label>Place<select value={form.place} onChange={(event) => setForm({ ...form, place: event.target.value })}><option value="">Choose place</option>{CUSTOMER_PLACES.map((place) => <option key={place}>{place}</option>)}</select></label>
      <label className="admin-profile-wide">Go-to requirements<textarea rows={3} value={form.goToRequirements} onChange={(event) => setForm({ ...form, goToRequirements: event.target.value })} placeholder="Frequent stones, cuts, sizes, colors, quantities or delivery preferences" /></label>
    </div>
    <h3 style={{ fontSize: 15, margin: '18px 0 4px' }}>Usual picks</h3>
    <p style={{ fontSize: 12.5, color: '#756e5c', margin: '0 0 10px' }}>What this buyer means by a colour. When they order by colour alone (Quick Order or the home page colour chips), the stone and grade fill in from here. Colours left out use the shop defaults (Website content → Quick Order setup).</p>
    <PreferencesEditor categories={categories} value={preferences} onChange={setPreferences} />
    <div className="admin-form-actions"><button className="btn" type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save customer'}</button>{message && <span role="status">{message}</span>}</div>
  </section>;
}
