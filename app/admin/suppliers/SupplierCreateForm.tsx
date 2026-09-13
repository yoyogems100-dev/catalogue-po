'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SupplierCreateForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  async function create() {
    if (!name.trim()) return setMessage('Enter the supplier name.');
    setSaving(true); setMessage('');
    const response = await fetch('/api/admin/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, phone }) });
    const data = await response.json().catch(() => ({})); setSaving(false);
    if (!response.ok) return setMessage(data.error || 'Could not create supplier.');
    router.push(`/admin/suppliers/${data.id}`);
  }
  if (!open) return <button className="btn" type="button" onClick={() => setOpen(true)}>+ Add supplier</button>;
  return <div className="admin-inline-create"><input autoFocus placeholder="Supplier name" value={name} onChange={(event) => setName(event.target.value)} /><input placeholder="Phone (optional)" value={phone} onChange={(event) => setPhone(event.target.value)} /><button className="btn" onClick={create} disabled={saving}>{saving ? 'Adding…' : 'Add'}</button><button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>{message && <span role="status">{message}</span>}</div>;
}
