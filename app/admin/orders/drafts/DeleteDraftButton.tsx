'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { confirmAction, notify } from '@/components/admin/AdminDialogs';

/** Deletes one draft order for good (a draft is not an order, so there is no Bin for it). */
export default function DeleteDraftButton({ id, label }: { id: number; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (busy || !(await confirmAction(`Delete the draft for ${label}? Its lines are lost; this cannot be undone.`))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/order-drafts/${id}`, { method: 'DELETE' });
      if (res.ok) { notify('Draft deleted.', 'ok'); router.refresh(); }
      else { const d = await res.json().catch(() => ({})); notify(d.error || 'Could not delete the draft. Please retry.'); }
    } catch {
      notify('Connection failed. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn-ghost draft-delete" onClick={remove} disabled={busy} aria-label={`Delete draft for ${label}`}>
      {busy ? 'Deleting…' : 'Delete'}
    </button>
  );
}
