'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M4 7h16" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

// Icon-only, no "Delete" text -- this moves the row to the Bin (soft delete,
// recoverable there), not a permanent delete, so a plain confirm is enough;
// permanent deletion is a separate, explicit action only offered on the Bin
// page itself.
export default function DeleteRowButton({ endpoint, confirmText, label }: { endpoint: string; confirmText: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy || !confirm(confirmText)) return;
    setBusy(true);
    try {
      const res = await fetch(endpoint, { method: 'DELETE' });
      if (res.ok) router.refresh();
      else { const d = await res.json().catch(() => ({})); alert(d.error || 'Could not move this to the bin. Please retry.'); }
    } catch {
      alert('Connection failed. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="admin-delete-row-btn"
      onClick={handleDelete}
      disabled={busy}
      aria-label={label}
      title={label}
    >
      <TrashIcon />
    </button>
  );
}
