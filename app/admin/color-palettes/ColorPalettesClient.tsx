'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MultiSelect from '@/components/MultiSelect';

type ColorRow = { id: number; name: string; hex_value: string | null };
type Palette = { id: number; name: string; colorIds: number[] };

export default function ColorPalettesClient({ palettes, colors }: { palettes: Palette[]; colors: ColorRow[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState('');

  async function addPalette() {
    if (!newName.trim()) return;
    const res = await fetch('/api/color-palettes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to add palette.');
      return;
    }
    setNewName('');
    router.refresh();
  }

  async function removePalette(id: number) {
    if (!confirm('Delete this palette? It stops appearing as a quick-select everywhere -- the colors themselves are unaffected.')) return;
    await fetch('/api/color-palettes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    router.refresh();
  }

  async function toggleColor(paletteId: number, colorId: number, currentlyIn: boolean) {
    const res = await fetch('/api/color-palettes/items', {
      method: currentlyIn ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ palette_id: paletteId, color_id: colorId })
    });
    if (!res.ok) throw new Error('Failed to update palette');
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input type="text" placeholder="New palette name, e.g. Excellent Star CP" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn" onClick={addPalette}>Add palette</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {palettes.map((p) => (
          <div key={p.id} className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong style={{ fontSize: 14 }}>{p.name}</strong>
              <button className="btn-ghost" style={{ fontSize: 11, color: '#a3341f' }} onClick={() => removePalette(p.id)}>Delete</button>
            </div>
            <MultiSelect
              options={colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex_value }))}
              selectedIds={p.colorIds}
              onToggle={(colorId, active) => toggleColor(p.id, colorId, active)}
              leading="swatch"
              placeholder="No colors in this palette yet"
            />
          </div>
        ))}
        {palettes.length === 0 && <p style={{ fontSize: 13, color: '#8a8370' }}>No palettes yet -- add one above.</p>}
      </div>
    </div>
  );
}
