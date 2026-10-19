'use client';

import { useState } from 'react';
import { balanceOf, lineState } from '@/lib/line-fulfilment';

const fmt = (n: number) => n.toLocaleString('en-IN');

/**
 * "Sent 400 of 1,000 · 600 left" with a box to change it, an "All sent"
 * shortcut and a Check flag. Saves on its own as soon as something changes.
 */
export default function LineFulfilment({
  itemId,
  quantity,
  initialSent,
  initialCheck,
  unit,
  compact = false,
  onSaved,
}: {
  itemId: number;
  quantity: number;
  initialSent: number;
  initialCheck: boolean;
  unit?: string | null;
  compact?: boolean;
  onSaved?: (sent: number, check: boolean) => void;
}) {
  const [sent, setSent] = useState(initialSent);
  const [draft, setDraft] = useState(String(initialSent || ''));
  const [check, setCheck] = useState(initialCheck);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(patch: { sentQty?: number; needsCheck?: boolean }) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/order-items/${itemId}/fulfilment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save');
      setSent(data.sentQty);
      setDraft(String(data.sentQty || ''));
      setCheck(data.needsCheck);
      onSaved?.(data.sentQty, data.needsCheck);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
      setDraft(String(sent || ''));
    } finally {
      setSaving(false);
    }
  }

  function commit() {
    const v = draft.trim() === '' ? 0 : Number(draft);
    if (!Number.isSafeInteger(v) || v < 0) { setDraft(String(sent || '')); return; }
    const capped = quantity > 0 ? Math.min(v, quantity) : v;
    if (capped !== sent) save({ sentQty: capped });
    else setDraft(String(sent || ''));
  }

  const state = lineState(quantity, sent);
  const left = balanceOf(quantity, sent);
  const u = unit ? ` ${unit}` : '';
  return (
    <div className={`line-fulfil line-fulfil--${state}${compact ? ' line-fulfil--compact' : ''}`} aria-busy={saving || undefined}>
      <label className="line-fulfil-sent">
        <span>Sent</span>
        <input
          type="text"
          inputMode="numeric"
          value={draft}
          placeholder="0"
          aria-label={`Amount sent, of ${fmt(quantity)}${u}`}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
          disabled={saving}
        />
      </label>
      <span className="line-fulfil-state">
        {state === 'sent' ? 'All sent' : state === 'part' ? `${fmt(left)}${u} left` : 'Not sent'}
      </span>
      {state !== 'sent' && quantity > 0 && (
        <button type="button" className="line-fulfil-all" disabled={saving} onClick={() => save({ sentQty: quantity })}>All sent</button>
      )}
      <label className="line-fulfil-check" title="Flag this line to check (stock, quality, sample)">
        <input type="checkbox" checked={check} disabled={saving} onChange={(e) => save({ needsCheck: e.target.checked })} />
        Check
      </label>
      {error && <span className="line-fulfil-error" role="alert">{error}</span>}
    </div>
  );
}
