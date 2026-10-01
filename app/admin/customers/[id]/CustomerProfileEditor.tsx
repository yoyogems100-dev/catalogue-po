'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PlaceInput from '@/components/admin/PlaceInput';
import type { OrderPreference } from '@/lib/customer-preferences';
import CustomerInterestsField from '@/components/admin/CustomerInterestsField';
import { sanitizeInterestIds } from '@/lib/customer-interests';

type Customer = { id: number; name: string | null; company: string | null; phone: string | null; email: string | null; work_stream?: string | null; go_to_requirements?: string | null; place?: string | null; order_preferences?: OrderPreference[] | null; interest_category_ids?: number[] | null; show_interests?: boolean | null };

export default function CustomerProfileEditor({ customer, placeSuggestions, categories }: { customer: Customer; placeSuggestions: string[]; categories: { id: number; name: string; slug: string | null }[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: customer.name || '', company: customer.company || '', phone: customer.phone || '', email: customer.email || '', workStream: customer.work_stream || '', goToRequirements: customer.go_to_requirements || '', place: customer.place || '', interestCategoryIds: sanitizeInterestIds(customer.interest_category_ids), showInterests: customer.show_interests !== false });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  async function save() {
    setSaving(true); setMessage('');
    const response = await fetch(`/api/admin/customers/${customer.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
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
      <label>Place<PlaceInput value={form.place} onChange={(place) => setForm({ ...form, place })} suggestions={placeSuggestions} /></label>
      <div className="admin-profile-wide admin-profile-field">
        <span>Go-to requirements</span>
        <CustomerInterestsField categories={categories} ids={form.interestCategoryIds} show={form.showInterests} onChange={({ ids, show }) => setForm({ ...form, interestCategoryIds: ids, showInterests: show })} />
      </div>
      <label className="admin-profile-wide">Requirement notes<textarea rows={2} value={form.goToRequirements} onChange={(event) => setForm({ ...form, goToRequirements: event.target.value })} placeholder="Sizes, colours, quantities or delivery preferences" /></label>
    </div>
    <div className="admin-form-actions"><button className="btn" type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save customer'}</button>{message && <span role="status">{message}</span>}</div>
  </section>;
}
