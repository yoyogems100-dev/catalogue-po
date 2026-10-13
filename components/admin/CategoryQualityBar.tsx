'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QUALITY_MAX_LENGTH } from '@/lib/qualities';

type Shape = { id: number; name: string };

// The qualities this category's order form offers (4A, 5A, 7A...), editable
// in place on every tab of its workspace, like its tags. With none, buyers see
// no Quality field. Tap + to pick from the usual ones or type a new one;
// × takes one away. Past orders keep the quality they were placed with.
//
// A shape/cut can have its own list instead (Nano's Green OSP HW: 3A / AA),
// which buyers see only while that shape/cut is picked, starting on its first.
export default function CategoryQualityBar({ categoryId, initial, known, shapes = [], shapeInitial = {} }: {
  categoryId: number;
  initial: string[];
  known: string[];
  shapes?: Shape[];
  shapeInitial?: Record<number, string[]>;
}) {
  const router = useRouter();
  const [shapeIds, setShapeIds] = useState<number[]>(() => shapes.filter((s) => shapeInitial[s.id]?.length).map((s) => s.id));
  const [picking, setPicking] = useState(false);

  async function save(next: string[], shapeId?: number): Promise<string[] | string> {
    const res = await fetch(`/api/admin/categories/${categoryId}/qualities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qualities: next, ...(shapeId ? { shapeId } : {}) })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error || 'Could not save -- try again.';
    router.refresh();
    return data.qualities;
  }

  const free = shapes.filter((s) => !shapeIds.includes(s.id));

  return (
    <>
      <QualityChips
        label="Quality"
        initial={initial}
        known={known}
        empty="No quality field — buyers don’t choose one"
        removePrompt={(q) => `Stop offering “${q}” for this category? Past orders keep it.`}
        onSave={(next) => save(next)}
      />
      {shapeIds.map((id) => {
        const shape = shapes.find((s) => s.id === id);
        if (!shape) return null;
        return (
          <QualityChips
            key={id}
            label={shape.name}
            initial={shapeInitial[id] || []}
            known={known}
            empty="Uses the category’s quality"
            hint="First is pre-selected"
            removePrompt={(q) => `Stop offering “${q}” for ${shape.name}? Past orders keep it.`}
            onSave={(next) => save(next, id)}
          />
        );
      })}
      {free.length > 0 && (
        <div className="cat-quality-shape-add">
          {picking ? (
            <select
              autoFocus
              defaultValue=""
              aria-label="Shape/cut with its own quality"
              onChange={(e) => { const id = Number(e.target.value); if (id) setShapeIds((cur) => [...cur, id]); setPicking(false); }}
              onBlur={() => setPicking(false)}
            >
              <option value="" disabled>Choose a shape/cut…</option>
              {free.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          ) : (
            <button type="button" className="po-inline-link" onClick={() => setPicking(true)}>+ Different quality for one shape/cut</button>
          )}
        </div>
      )}
    </>
  );
}

function QualityChips({ label, initial, known, empty, hint, removePrompt, onSave }: {
  label: string;
  initial: string[];
  known: string[];
  empty: string;
  hint?: string;
  removePrompt: (q: string) => string;
  onSave: (next: string[]) => Promise<string[] | string>;
}) {
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
    const result = await onSave(next);
    setBusy(false);
    if (typeof result === 'string') { setError(result); return false; }
    setQualities(result);
    return true;
  }

  function add(q: string) {
    const quality = q.replace(/\s+/g, ' ').trim();
    if (!quality || busy) return;
    if (has(quality)) { setError(`“${quality}” is already here.`); return; }
    void save([...qualities, quality]).then((ok) => { if (ok) setTyped(''); });
  }

  function remove(q: string) {
    if (!confirm(removePrompt(q))) return;
    void save(qualities.filter((x) => x !== q));
  }

  return (
    <section className="cat-tag-bar cat-quality-bar" aria-label={`Qualities: ${label}`}>
      <span className="cat-tag-bar-label">{label}</span>
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
        <button type="button" className="tag-chip cat-tag-plus" onClick={() => setAdding(true)} aria-label={`Add a quality for ${label}`}>+</button>
      )}
      {!qualities.length && !adding && <span className="cat-tag-empty">{empty}</span>}
      {qualities.length > 1 && hint && !adding && <span className="cat-tag-empty">{hint}</span>}
      {error && <p className="cat-tag-error" role="alert">{error}</p>}
    </section>
  );
}
