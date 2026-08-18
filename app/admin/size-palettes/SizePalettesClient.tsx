'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Palette = { id: number; name: string; sizeMms: string[] };

export default function SizePalettesClient({ palettes }: { palettes: Palette[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState('');
  const [newSizes, setNewSizes] = useState<Record<number, string>>({});

  async function addPalette() {
    if (!newName.trim()) return;
    const res = await fetch('/api/size-palettes', {
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
    if (!confirm('Delete this palette? It stops appearing as a quick-select everywhere.')) return;
    await fetch('/api/size-palettes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    router.refresh();
  }

  async function addSizes(paletteId: number) {
    const text = newSizes[paletteId] || '';
    if (!text.trim()) return;
    const sizes = text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    const res = await fetch('/api/size-palettes/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ palette_id: paletteId, sizes })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to add sizes.');
      return;
    }
    setNewSizes((cur) => ({ ...cur, [paletteId]: '' }));
    router.refresh();
  }

  async function removeSize(paletteId: number, sizeMm: string) {
    await fetch('/api/size-palettes/items', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ palette_id: paletteId, size_mm: sizeMm })
    });
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input type="text" placeholder="New palette name, e.g. Melee Range" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn" onClick={addPalette}>Add palette</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {palettes.map((p) => (
          <div key={p.id} className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong style={{ fontSize: 14 }}>{p.name}</strong>
              <button className="btn-ghost" style={{ fontSize: 11, color: '#a3341f' }} onClick={() => removePalette(p.id)}>Delete</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {p.sizeMms.map((sz) => (
                <span key={sz} className="tag-chip">
                  {sz}mm
                  <span style={{ cursor: 'pointer', color: '#a3341f' }} onClick={() => removeSize(p.id, sz)}>&times;</span>
                </span>
              ))}
              {p.sizeMms.length === 0 && <span style={{ fontSize: 12, color: '#8a8370' }}>No sizes yet.</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="0.8, 1.0, 1.1, 1.5 -- comma separated"
                value={newSizes[p.id] || ''}
                onChange={(e) => setNewSizes((cur) => ({ ...cur, [p.id]: e.target.value }))}
              />
              <button className="btn" onClick={() => addSizes(p.id)}>Add</button>
            </div>
          </div>
        ))}
        {palettes.length === 0 && <p style={{ fontSize: 13, color: '#8a8370' }}>No palettes yet -- add one above.</p>}
      </div>
    </div>
  );
}
