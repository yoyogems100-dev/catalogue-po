'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { COURIERS_SETTING_KEY, MAX_COURIER_NAME, cleanCourierList } from '@/lib/couriers';

// The courier names offered on each order. Removing one here doesn't touch
// orders that already have it.
export default function CouriersEditor({ initial }: { initial: string[] }) {
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const dirty = JSON.stringify(list) !== saved;

  function add() {
    const next = cleanCourierList([...list, draft]);
    if (next.length === list.length) { setToast(draft.trim() ? 'Already in the list.' : ''); return; }
    setList(next);
    setDraft('');
    setToast('');
  }

  async function save() {
    setBusy(true);
    setToast('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: COURIERS_SETTING_KEY, value: JSON.stringify(list) })
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setToast(d.error || 'Could not save.'); return; }
      setSaved(JSON.stringify(list));
      setToast('Saved.');
      router.refresh();
    } catch {
      setToast('Connection failed. Nothing was saved.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card courier-editor" aria-labelledby="couriers-heading">
      <h2 id="couriers-heading">Couriers</h2>
      <p className="courier-help">Pick one on an order and <code>{'{courier}'}</code> in a message becomes its name, e.g. &ldquo;Sent through DTDC.&rdquo; A line with <code>{'{courier}'}</code> is left out until a courier is chosen.</p>
      <ul className="courier-list">
        {list.map((name) => (
          <li key={name}>
            <span>{name}</span>
            <button type="button" aria-label={`Remove ${name}`} onClick={() => { setList((l) => l.filter((n) => n !== name)); setToast(''); }}>&times;</button>
          </li>
        ))}
        {!list.length && <li className="courier-empty">No couriers yet.</li>}
      </ul>
      <form className="courier-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input value={draft} maxLength={MAX_COURIER_NAME} placeholder="Add a courier" aria-label="Courier name" onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" className="btn-ghost" disabled={!draft.trim()}>Add</button>
      </form>
      <div className="stage-save-bar courier-save">
        {toast && <span role="status" aria-live="polite">{toast}</span>}
        <button type="button" className="btn" onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : dirty ? 'Save couriers' : 'Saved'}</button>
      </div>
    </section>
  );
}
