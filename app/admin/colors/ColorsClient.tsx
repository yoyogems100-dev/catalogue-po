'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MultiSelect from '@/components/MultiSelect';

type ColorRow = { id: number; name: string; hex_value: string | null };
type Category = { id: number; num: number; name: string };
type CatColor = { category_id: number; color_id: number };

export default function ColorsClient({
  colors,
  categories,
  catColors
}: {
  colors: ColorRow[];
  categories: Category[];
  catColors: CatColor[];
}) {
  const router = useRouter();
  const [newColor, setNewColor] = useState('');
  const [newHex, setNewHex] = useState('#B0AFAC');
  const [expandedCats, setExpandedCats] = useState<number | null>(null);

  async function add() {
    if (!newColor.trim()) return;
    const res = await fetch('/api/colors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newColor, hex_value: newHex })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to add color -- a color with this name may already exist.');
      return;
    }
    setNewColor('');
    setNewHex('#B0AFAC');
    router.refresh();
  }

  async function remove(id: number) {
    if (!confirm('Delete this color?')) return;
    await fetch('/api/colors', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    router.refresh();
  }

  async function updateHex(id: number, hex: string) {
    await fetch('/api/colors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, hex_value: hex })
    });
    router.refresh();
  }

  async function toggleCategory(colorId: number, categoryId: number, currentlyLinked: boolean) {
    const res = await fetch('/api/category-links/color', {
      method: currentlyLinked ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId, color_id: colorId })
    });
    if (!res.ok) throw new Error('Failed to update link');
    router.refresh();
  }

  async function moveColor(id: number, direction: 'up' | 'down') {
    const res = await fetch('/api/colors/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color_id: id, direction })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to reorder color');
      return;
    }
    router.refresh();
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, maxWidth: 480, alignItems: 'center' }}>
        <input type="text" placeholder="New color name" value={newColor} onChange={(e) => setNewColor(e.target.value)} />
        <input
          type="color"
          value={newHex}
          onChange={(e) => setNewHex(e.target.value)}
          style={{ width: 40, height: 36, padding: 2, border: '1px solid var(--line)', cursor: 'pointer', flexShrink: 0 }}
        />
        <button className="btn" onClick={add} style={{ whiteSpace: 'nowrap' }}>Add color</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {colors.map((c, index) => {
          const linkedCatIds = catColors.filter((cc) => cc.color_id === c.id).map((cc) => cc.category_id);
          const catsOpen = expandedCats === c.id;
          return (
            <div key={c.id} className="card" style={{ padding: '8px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => moveColor(c.id, 'up')} disabled={index === 0}>&uarr;</button>{' '}
                  <button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => moveColor(c.id, 'down')} disabled={index === colors.length - 1}>&darr;</button>
                </span>
                <input
                  type="color"
                  value={c.hex_value || '#B0AFAC'}
                  onChange={(e) => updateHex(c.id, e.target.value)}
                  title="Click to change hex"
                  style={{ width: 28, height: 28, padding: 0, border: '1px solid var(--line)', cursor: 'pointer', flexShrink: 0 }}
                />
                <span style={{ fontSize: 13.5, minWidth: 140, flex: '1 1 140px' }}>{c.name}</span>
                <span style={{ fontSize: 11, color: '#8a8370', fontFamily: 'monospace' }}>{c.hex_value}</span>
                <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => { setExpandedCats(catsOpen ? null : c.id); }}>
                  {linkedCatIds.length} categories {catsOpen ? '▲' : '▼'}
                </button>
                <span style={{ cursor: 'pointer', color: '#a3341f', fontSize: 18, marginLeft: 'auto' }} onClick={() => remove(c.id)}>&times;</span>
              </div>
              {catsOpen && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)', maxWidth: 420 }}>
                  <p style={{ fontSize: 12, color: '#8a8370', marginBottom: 8 }}>
                    Which categories should offer "{c.name}" as a color option.
                  </p>
                  <MultiSelect
                    options={categories.map((cat) => ({ id: cat.id, name: cat.name }))}
                    selectedIds={linkedCatIds}
                    onToggle={(catId, active) => toggleCategory(c.id, catId, active)}
                    placeholder="Not linked to any category"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
