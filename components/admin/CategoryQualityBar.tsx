'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QUALITY_MAX_LENGTH } from '@/lib/qualities';

// The qualities this category's order form offers (4A, 5A, 7A...), editable
// in place on every tab of its workspace, like its tags. With none, buyers see
// no Quality field. Tap + to pick from the usual ones or type a new one;
// × takes one away. Past orders keep the quality they were placed with.
export default function CategoryQualityBar({ categoryId, initial, known }: { categoryId: number; initial: string[]; known: string[] }) {
  const router = useRouter();
  const [qualities, setQualities] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const has = (q: string) => qualities.some((x) => x.toLowerCase() === q.toLowerCase());
  const offers = known.filter((q) => !has(q));

  async function save(next: string[]) {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/admin/categories/${categoryId}/qualities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qualities: next })
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error || 'Could not save -- try again.'); return false; }
    setQualities(data.qualities);
    router.refresh();
    return true;
  }

  function add(q: string) {
    const quality = q.replace(/\s+/g, ' ').trim();
    if (!quality || busy) return;
    if (has(quality)) { setError(`“${quality}” is already here.`); return; }
    void save([...qualities, quality]).then((ok) => { if (ok) setTyped(''); });
  }

  function remove(q: string) {
    if (!confirm(`Stop offering “${q}” for this category? Past orders keep it.`)) return;
    void save(qualities.filter((x) => x !== q));
  }

  return (
    <section className="cat-tag-bar cat-quality-bar" aria-label="Qualities">
      <span className="cat-tag-bar-label">Quality</span>
      {qualities.map((q) => (
        <span key={q} className="tag-chip cat-tag-chip">
          {q}
          <button type="button" className="cat-tag-x" aria-label={`Remove quality ${q}`} disabled={busy} onClick={() => remove(q)}>&times;</button>
        </span>
      ))}
      {adding ? (
        <div className="cat-quality-add">
          {offers.map((q) => (
            <button key={q} type="button" className="tag-chip cat-quality-offer" disabled={busy} onClick={() => add(q)}>+ {q}</button>
          ))}
          <form className="cat-tag-add" onSubmit={(e) => { e.preventDefault(); add(typed); }}>
            <input
              type="text" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="New quality"
              aria-label="New quality" maxLength={QUALITY_MAX_LENGTH}
              onKeyDown={(e) => { if (e.key === 'Escape') setAdding(false); }}
            />
            <button type="submit" className="btn" disabled={busy || !typed.trim()}>{busy ? 'Saving…' : 'Add'}</button>
            <button type="button" className="btn-ghost" onClick={() => { setAdding(false); setTyped(''); setError(''); }}>Done</button>
          </form>
        </div>
      ) : (
        <button type="button" className="tag-chip cat-tag-plus" onClick={() => setAdding(true)} aria-label="Add a quality">+</button>
      )}
      {!qualities.length && !adding && <span className="cat-tag-empty">No quality field — buyers don’t choose one</span>}
      {error && <p className="cat-tag-error" role="alert">{error}</p>}
    </section>
  );
}
