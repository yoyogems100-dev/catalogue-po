'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { confirmAction } from '@/components/admin/AdminDialogs';

// Archive / restore from inside a category's workspace. Archived categories
// get a banner so nobody edits one thinking customers can see it.
export default function CategoryArchiveToggle({ id, name, archivedAt }: { id: number; name: string; archivedAt: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(archived: boolean) {
    if (busy) return;
    if (archived && !(await confirmAction(`Archive "${name}"?\n\nIt will be hidden from the website and catalogue straight away. Its photos, shapes, colours, prices and past orders are all kept, and you can restore it any time.`))) return;
    setBusy(true); setError('');
    const res = await fetch('/api/categories', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, archived })
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error || 'Could not update this category.'); return; }
    router.refresh();
  }

  if (!archivedAt) {
    return (
      <>
        <button type="button" className="btn-ghost size-chart-download" disabled={busy} onClick={() => save(true)}>
          {busy ? 'Archiving...' : 'Archive category'}
        </button>
        {error && <span role="alert" className="admin-archive-error">{error}</span>}
      </>
    );
  }

  const date = new Date(archivedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="admin-archive-banner" role="status">
      <p><strong>Archived on {date}.</strong> This category is hidden from the website and catalogue. Changes you make here are saved but customers won’t see them until you restore it.</p>
      <button type="button" className="btn" disabled={busy} onClick={() => save(false)}>{busy ? 'Restoring...' : 'Restore category'}</button>
      {error && <span role="alert" className="admin-archive-error">{error}</span>}
    </div>
  );
}
