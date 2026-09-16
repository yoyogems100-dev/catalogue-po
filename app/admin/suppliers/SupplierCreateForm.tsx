'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import IconSelect from '@/components/IconSelect';

export default function SupplierCreateForm({ categories }: { categories: { id: number; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  async function create() {
    if (!name.trim()) return setMessage('Enter the supplier name.');
    setSaving(true); setMessage('');
    const response = await fetch('/api/admin/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, company, address, phone, categoryIds }) });
    const data = await response.json().catch(() => ({})); setSaving(false);
    if (!response.ok) return setMessage(data.error || 'Could not create supplier.');
    router.push(`/admin/suppliers/${data.id}`);
  }
  if (!open) return <button className="btn" type="button" onClick={() => setOpen(true)}>+ Add supplier</button>;
  return (
    <div className="card admin-inline-create" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, maxWidth: 480 }}>
      <input autoFocus placeholder="Supplier name" value={name} onChange={(event) => setName(event.target.value)} />
      <input placeholder="Company (optional)" value={company} onChange={(event) => setCompany(event.target.value)} />
      <input placeholder="Address (optional)" value={address} onChange={(event) => setAddress(event.target.value)} />
      <input placeholder="Phone (optional)" value={phone} onChange={(event) => setPhone(event.target.value)} />
      <div>
        <label style={{ display: 'block', fontSize: 12.5, marginBottom: 4 }}>Categories dealt in</label>
        <IconSelect options={categories} multiple values={categoryIds} onChange={setCategoryIds} placeholder="Choose categories" searchable leading="none" />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn" onClick={create} disabled={saving}>{saving ? 'Adding…' : 'Add supplier'}</button>
        <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        {message && <span role="status">{message}</span>}
      </div>
    </div>
  );
}
