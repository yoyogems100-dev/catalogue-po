'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Tag = { id: number; name: string; is_global: boolean };

export default function TagsClient({ tags }: { tags: Tag[] }) {
  const router = useRouter();
  const [newTag, setNewTag] = useState('');

  async function add() {
    if (!newTag.trim()) return;
    await fetch('/api/tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newTag, is_global: true }) });
    setNewTag('');
    router.refresh();
  }

  async function remove(id: number) {
    if (!confirm('Delete this tag? It will be removed from every category and photo using it.')) return;
    await fetch('/api/tags', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
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
            <span style={{ cursor: 'pointer', color: '#a3341f' }} onClick={() => remove(t.id)}>&times;</span>
          </span>
        ))}
      </div>
    </>
  );
}
