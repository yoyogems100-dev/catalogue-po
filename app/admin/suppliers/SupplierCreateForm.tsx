'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import IconSelect from '@/components/IconSelect';

// A centered modal, not an inline card that expanded into its own row on the
// page (pushing the button row and everything below it down, and squeezing
// the category dropdown into a narrow card) -- same <dialog> pattern as the
// login/Quick Order popups.
export default function SupplierCreateForm({ categories }: { categories: { id: number; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { if (open && !dialog.current?.open) dialog.current?.showModal(); }, [open]);

  function close() { dialog.current?.close(); }

  function reset() {
    setName(''); setCompany(''); setAddress(''); setPhone(''); setCategoryIds([]); setMessage('');
  }

  async function create() {
    if (!name.trim()) return setMessage('Enter the supplier name.');
    setSaving(true); setMessage('');
    const response = await fetch('/api/admin/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, company, address, phone, categoryIds }) });
    const data = await response.json().catch(() => ({})); setSaving(false);
    if (!response.ok) return setMessage(data.error || 'Could not create supplier.');
    router.push(`/admin/suppliers/${data.id}`);
  }

  return (
    <>
      <button className="btn" type="button" onClick={() => setOpen(true)}>+ Add supplier</button>
      {open && (
        <dialog
          ref={dialog}
          className="admin-create-dialog"
          aria-label="Add supplier"
          onCancel={(e) => { e.preventDefault(); close(); }}
          onClose={() => { setOpen(false); reset(); }}
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="admin-create-dialog-head">
            <strong>Add supplier</strong>
            <button type="button" autoFocus onClick={close} aria-label="Close">✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
              <button className="btn-ghost" onClick={close}>Cancel</button>
              {message && <span role="status">{message}</span>}
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
