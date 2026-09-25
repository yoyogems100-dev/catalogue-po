'use client';

import { useState } from 'react';
import ColorSwatch from '@/components/ColorSwatch';
import { COLOR_BUTTONS_SETTING_KEY, COLOR_FAMILIES } from '@/lib/color-family';

// Every colour family, shown ones first in the buyer-facing order, hidden ones
// after. Saved as the shown IDs only.
export default function ColorButtonsEditor({ initialIds }: { initialIds: number[] }) {
  const [rows, setRows] = useState(() => [
    ...initialIds.map((id) => ({ id, shown: true })),
    ...COLOR_FAMILIES.filter((f) => !initialIds.includes(f.id)).map((f) => ({ id: f.id, shown: false }))
  ]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
    setStatus('');
  }

  async function save() {
    setSaving(true);
    setStatus('');
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: COLOR_BUTTONS_SETTING_KEY, value: rows.filter((r) => r.shown).map((r) => r.id).join(',') })
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    setStatus(res.ok ? 'Saved. Buyers see the new buttons the next time they open the site.' : `Could not save: ${data.error || res.status}`);
  }

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <ol className="most-ordered-list">
        {rows.map((row, i) => {
          const family = COLOR_FAMILIES.find((f) => f.id === row.id)!;
          return (
            <li key={row.id} style={row.shown ? undefined : { opacity: 0.55 }}>
              <input
                type="checkbox"
                checked={row.shown}
                aria-label={`Show ${family.name}`}
                onChange={(e) => { setRows(rows.map((r) => (r.id === row.id ? { ...r, shown: e.target.checked } : r))); setStatus(''); }}
              />
              <ColorSwatch hex={family.hex} refPhotoUrl={family.refPhotoUrl} size={22} />
              <span className="most-ordered-name">{family.name}{row.shown ? '' : ' (hidden)'}</span>
              <button type="button" className="btn-ghost" aria-label={`Move ${family.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="btn-ghost" aria-label={`Move ${family.name} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>↓</button>
            </li>
          );
        })}
      </ol>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
        <button type="button" className="btn" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save colour buttons'}</button>
        {status && <span role="status" style={{ fontSize: 13 }}>{status}</span>}
      </div>
    </div>
  );
}
