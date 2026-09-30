'use client';

import { useMemo, useState } from 'react';
import { packetGroups, packetKey, type PacketLine, type PacketMode, type PacketWeights as Saved } from '@/lib/packet-weights';
import type { WeightUnit } from '@/lib/quantity-field';

// One weight per packet, entered once the goods are packed. A packet is
// every line of one shape, or of one shape and size (12 materials of Oval
// 6x8 mm in one packet) -- the team picks which. Printed on the order PDF.
export default function PacketWeights({ orderId, lines, saved, defaultUnitOf, onSaved }: {
  orderId: number;
  lines: PacketLine[];
  saved: Saved | null;
  /** The unit a packet starts on for its category (ct for Semi Precious). */
  defaultUnitOf: Record<number, WeightUnit>;
  onSaved: (message: string) => void;
}) {
  const [mode, setMode] = useState<PacketMode>(saved?.mode || 'shape_size');
  const initial = () => Object.fromEntries((saved?.packets || []).map((p) => [packetKey(p.categoryId, p.shapeId, p.sizeId), { weight: String(p.weight), unit: p.unit }]));
  const [values, setValues] = useState<Record<string, { weight: string; unit: WeightUnit }>>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const groups = useMemo(() => packetGroups(lines, mode), [lines, mode]);
  if (!groups.length) return null;
  const valueOf = (key: string, categoryId: number) => values[key] || { weight: '', unit: defaultUnitOf[categoryId] || 'g' };
  const set = (key: string, categoryId: number, patch: Partial<{ weight: string; unit: WeightUnit }>) =>
    setValues((cur) => ({ ...cur, [key]: { ...valueOf(key, categoryId), ...patch } }));
  const showCategory = new Set(groups.map((g) => g.categoryId)).size > 1;

  async function save() {
    setSaving(true);
    setError('');
    const packets = groups
      .map((g) => ({ g, v: valueOf(g.key, g.categoryId) }))
      .filter(({ v }) => v.weight.trim() !== '')
      .map(({ g, v }) => ({ categoryId: g.categoryId, shapeId: g.shapeId, sizeId: g.sizeId, weight: Number(v.weight), unit: v.unit }));
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/packet-weights`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, packets })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Packet weights could not be saved. Please retry.');
      onSaved(packets.length ? 'Packet weights saved. Generate a fresh PDF to include them.' : 'Packet weights cleared.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card packet-weights">
      <div className="packet-weights-head">
        <h4>Packet weights</h4>
        <div className="po-type-toggle" role="group" aria-label="Pack by">
          <button type="button" aria-pressed={mode === 'shape'} className={mode === 'shape' ? 'active' : ''} onClick={() => setMode('shape')}>By shape</button>
          <button type="button" aria-pressed={mode === 'shape_size'} className={mode === 'shape_size' ? 'active' : ''} onClick={() => setMode('shape_size')}>By shape &amp; size</button>
        </div>
      </div>
      <p className="packet-weights-hint">One weight for each packet. Leave a packet blank if it hasn&rsquo;t been weighed.</p>
      <div className="packet-weights-list">
        {groups.map((g) => {
          const v = valueOf(g.key, g.categoryId);
          return (
            <div className="packet-weights-row" key={g.key}>
              <div className="packet-weights-name">
                <strong>{g.label}</strong>
                <small>{showCategory ? `${g.categoryName} · ` : ''}{g.count} · {g.quantity}</small>
              </div>
              <input
                inputMode="decimal"
                placeholder="Weight"
                aria-label={`Packet weight for ${g.label}`}
                value={v.weight}
                onChange={(e) => set(g.key, g.categoryId, { weight: e.target.value.replace(/[^\d.]/g, '') })}
              />
              <select aria-label={`Weight unit for ${g.label}`} value={v.unit} onChange={(e) => set(g.key, g.categoryId, { unit: e.target.value as WeightUnit })}>
                <option value="ct">ct</option>
                <option value="g">g</option>
              </select>
            </div>
          );
        })}
      </div>
      {error && <p role="alert" className="login-error">{error}</p>}
      <button type="button" className="btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save packet weights'}</button>
    </div>
  );
}
