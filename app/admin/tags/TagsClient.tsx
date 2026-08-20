'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Tag = { id: number; name: string; is_global: boolean };

export default function TagsClient({ tags }: { tags: Tag[] }) {
  const router = useRouter();
  const [newTag, setNewTag] = useState('');
  const [toast, setToast] = useState('');

  // UI/UX audit ("visible saved-state feedback"): these mutations previously
  // ran silently -- a failed save and a successful one looked identical.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  async function add() {
    if (!newTag.trim()) return;
    const res = await fetch('/api/tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newTag, is_global: true }) });
    if (!res.ok) { setToast('Failed to add tag -- try again.'); return; }
    setNewTag('');
    setToast('Tag added.');
    router.refresh();
  }

  async function remove(id: number, name: string) {
    if (!confirm(`Delete "${name}"? It will be removed from every category and photo using it.`)) return;
    const res = await fetch('/api/tags', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (!res.ok) { setToast('Failed to delete tag -- try again.'); return; }
    setToast('Tag deleted.');
    router.refresh();
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, maxWidth: 420 }}>
        <input type="text" placeholder="New global tag" value={newTag} onChange={(e) => setNewTag(e.target.value)} />
        <button className="btn" onClick={add}>Add tag</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tags.map((t) => (
          <span key={t.id} className="tag-chip">
            {t.name}{!t.is_global && ' (category-specific)'}
            <button
              type="button"
              aria-label={`Delete tag ${t.name}`}
              style={{ cursor: 'pointer', color: '#a3341f', background: 'none', border: 'none', padding: 0, font: 'inherit' }}
              onClick={() => remove(t.id, t.name)}
            >
              &times;
            </button>
          </span>
        ))}
      </div>
      {toast && <p className="po-toast" role="status" aria-live="polite">{toast}</p>}
    </>
  );
}
