'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BinRowActions({ type, id, label }: { type: 'orders' | 'customers' | 'suppliers'; id: number; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'restore' | 'purge' | null>(null);

  async function restore() {
    setBusy('restore');
    const res = await fetch('/api/admin/bin/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, id }) });
    setBusy(null);
    if (res.ok) router.refresh();
    else alert('Could not restore. Please retry.');
  }

  async function purge() {
    if (!confirm(`Permanently delete ${label}? This cannot be undone.`)) return;
    setBusy('purge');
    const res = await fetch('/api/admin/bin/purge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, id }) });
    setBusy(null);
    if (res.ok) router.refresh();
    else alert('Could not permanently delete. Please retry.');
  }

  return (
    <span style={{ display: 'flex', gap: 8 }}>
      <button className="btn-ghost" onClick={restore} disabled={!!busy}>{busy === 'restore' ? 'Restoring…' : 'Restore'}</button>
      <button className="btn-danger" onClick={purge} disabled={!!busy}>{busy === 'purge' ? 'Deleting…' : 'Delete permanently'}</button>
    </span>
  );
}
