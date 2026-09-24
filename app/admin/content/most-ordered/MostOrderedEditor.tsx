'use client';

import { useState } from 'react';
import { MOST_ORDERED_SETTING_KEY, serializeMostOrdered } from '@/lib/most-ordered';

type Category = { id: number; name: string };

export default function MostOrderedEditor({ categories, initialIds }: { categories: Category[]; initialIds: number[] }) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const [ids, setIds] = useState(() => initialIds.filter((id) => byId.has(id)));
  const [adding, setAdding] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const available = categories.filter((c) => !ids.includes(c.id));

  function move(index: number, delta: number) {
    const next = [...ids];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setIds(next);
    setStatus('');
  }

  async function save() {
    setSaving(true);
    setStatus('');
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: MOST_ORDERED_SETTING_KEY, value: serializeMostOrdered(ids) })
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    setStatus(res.ok ? 'Saved. The home page updates within a minute.' : `Could not save: ${data.error || res.status}`);
  }

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      {ids.length === 0 && <p>No categories chosen — the home page will show every category in one list.</p>}
      <ol className="most-ordered-list">
        {ids.map((id, i) => (
          <li key={id}>
            <span className="most-ordered-rank">{i + 1}</span>
            <span className="most-ordered-name">{byId.get(id)?.name}</span>
            <button type="button" className="btn-ghost" aria-label={`Move ${byId.get(id)?.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button type="button" className="btn-ghost" aria-label={`Move ${byId.get(id)?.name} down`} disabled={i === ids.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button type="button" className="btn-ghost" aria-label={`Remove ${byId.get(id)?.name}`} onClick={() => { setIds(ids.filter((x) => x !== id)); setStatus(''); }}>✕</button>
          </li>
        ))}
      </ol>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Category to add" style={{ flex: '1 1 220px' }}>
          <option value="">Add a category…</option>
          {available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button type="button" className="btn-ghost" disabled={!adding} onClick={() => { setIds([...ids, Number(adding)]); setAdding(''); setStatus(''); }}>Add</button>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
        <button type="button" className="btn" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save order'}</button>
        {status && <span role="status" style={{ fontSize: 13 }}>{status}</span>}
      </div>
    </div>
  );
}
