'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MultiSelect from '@/components/MultiSelect';
import ColorSwatch from '@/components/ColorSwatch';
import { useDragReorder, moveItem } from '@/hooks/useDragReorder';

type ColorRow = { id: number; name: string; hex_value: string | null; ref_photo_url?: string | null };
type Category = { id: number; num: number; name: string };
type CatColor = { category_id: number; color_id: number };
type Palette = { id: number; name: string; colorIds: number[] };

export default function ColorsClient({
  colors,
  categories,
  catColors,
  palettes
}: {
  colors: ColorRow[];
  categories: Category[];
  catColors: CatColor[];
  palettes: Palette[];
}) {
  const router = useRouter();
  const [newColor, setNewColor] = useState('');
  const [newHex, setNewHex] = useState('#B0AFAC');
  const [expandedCats, setExpandedCats] = useState<number | null>(null);
  const [newPaletteName, setNewPaletteName] = useState('');
  const [search, setSearch] = useState('');

  const [localColors, setLocalColors] = useState(colors);
  useEffect(() => setLocalColors(colors), [colors]);

  const visibleColors = search.trim()
    ? localColors.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
    : localColors;

  async function addPalette() {
    if (!newPaletteName.trim()) return;
    const res = await fetch('/api/color-palettes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newPaletteName })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to add palette.');
      return;
    }
    setNewPaletteName('');
    router.refresh();
  }

  async function removePalette(id: number) {
    if (!confirm('Delete this palette? It stops appearing as a quick-select everywhere -- the colors themselves are unaffected.')) return;
    await fetch('/api/color-palettes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    router.refresh();
  }

  async function togglePaletteColor(paletteId: number, colorId: number, currentlyIn: boolean) {
    const res = await fetch('/api/color-palettes/items', {
      method: currentlyIn ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ palette_id: paletteId, color_id: colorId })
    });
    if (!res.ok) throw new Error('Failed to update palette');
    router.refresh();
  }

  const { dragHandleProps, dropTargetProps, dragIndex, overIndex } = useDragReorder(async (from, to) => {
    const prev = localColors;
    const next = moveItem(localColors, from, to);
    setLocalColors(next);
    const res = await fetch('/api/colors/reorder-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: next.map((c) => c.id) })
    });
    if (!res.ok) {
      setLocalColors(prev);
      alert('Failed to save the new order.');
      return;
    }
    router.refresh();
  });

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

  async function uploadPhoto(id: number, file: File | null | undefined) {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/colors/${id}/photo`, { method: 'POST', body: fd });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to upload photo.');
      return;
    }
    router.refresh();
  }

  async function removePhoto(id: number) {
    if (!confirm('Remove this reference photo? The swatch will fall back to the plain hex color.')) return;
    await fetch(`/api/colors/${id}/photo`, { method: 'DELETE' });
    router.refresh();
  }

  async function renameColor(id: number, name: string) {
    const res = await fetch('/api/colors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to rename color');
    }
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
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, maxWidth: 480, alignItems: 'center' }}>
        <input type="text" placeholder="New color name" value={newColor} onChange={(e) => setNewColor(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <input
          type="color"
          value={newHex}
          onChange={(e) => setNewHex(e.target.value)}
          style={{ width: 40, height: 36, padding: 2, border: '1px solid var(--line)', cursor: 'pointer', flexShrink: 0 }}
        />
        <button className="btn" onClick={add} style={{ whiteSpace: 'nowrap' }}>Add color</button>
      </div>
      <div style={{ marginBottom: 16, maxWidth: 280 }}>
        <input type="text" placeholder="Search colors..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visibleColors.map((c) => {
          const index = localColors.findIndex((lc) => lc.id === c.id);
          const linkedCatIds = catColors.filter((cc) => cc.color_id === c.id).map((cc) => cc.category_id);
          const catsOpen = expandedCats === c.id;
          const dragProps = search.trim() ? {} : dropTargetProps(index);
          return (
            <div
              key={c.id}
              className={`card ${!search.trim() && overIndex === index ? 'drag-over-card' : ''}`}
              style={{ padding: '8px 12px', opacity: !search.trim() && dragIndex === index ? 0.4 : 1 }}
              {...dragProps}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {!search.trim() && (
                  <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <span {...dragHandleProps(index)} className="drag-handle" title="Drag to reorder">&#9776;</span>{' '}
                    <button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => moveColor(c.id, 'up')} disabled={index === 0}>&uarr;</button>{' '}
                    <button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => moveColor(c.id, 'down')} disabled={index === localColors.length - 1}>&darr;</button>
                  </span>
                )}
                <ColorSwatch hex={c.hex_value} refPhotoUrl={c.ref_photo_url} name={c.name} size={28} />
                <input
                  type="color"
                  value={c.hex_value || '#B0AFAC'}
                  onChange={(e) => updateHex(c.id, e.target.value)}
                  title="Click to change hex"
                  style={{ width: 20, height: 20, padding: 0, border: '1px solid var(--line)', cursor: 'pointer', flexShrink: 0 }}
                />
                <span style={{ minWidth: 140, flex: '1 1 140px' }}>
                  <NameCell value={c.name} onSave={(name) => renameColor(c.id, name)} />
                </span>
                <span style={{ fontSize: 11, color: '#756e5c', fontFamily: 'monospace' }}>{c.hex_value}</span>
                <label className="btn-ghost" style={{ fontSize: 11, cursor: 'pointer' }}>
                  {c.ref_photo_url ? 'Change photo' : 'Add photo'}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => { uploadPhoto(c.id, e.target.files?.[0]); e.target.value = ''; }}
                  />
                </label>
                {c.ref_photo_url && (
                  <button className="btn-ghost" style={{ fontSize: 11, color: '#a3341f' }} onClick={() => removePhoto(c.id)}>Remove photo</button>
                )}
                <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => { setExpandedCats(catsOpen ? null : c.id); }}>
                  {linkedCatIds.length} categories {catsOpen ? '▲' : '▼'}
                </button>
                <span style={{ cursor: 'pointer', color: '#a3341f', fontSize: 18, marginLeft: 'auto' }} onClick={() => remove(c.id)}>&times;</span>
              </div>
              {catsOpen && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)', maxWidth: 420 }}>
                  <p style={{ fontSize: 12, color: '#756e5c', marginBottom: 8 }}>
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
        {visibleColors.length === 0 && <p style={{ fontSize: 13, color: '#756e5c' }}>No colors match "{search}".</p>}
      </div>

      <section style={{ marginTop: 36 }}>
        <h2 style={{ fontSize: 16, color: 'var(--ink)', marginBottom: 6 }}>Color Palettes</h2>
        <p style={{ fontSize: 12.5, color: '#756e5c', marginBottom: 14, maxWidth: 640 }}>
          Group colors into named sets (e.g. "Excellent Star CP") -- palettes show up as one-click quick-selects at
          the top of color dropdowns everywhere, checking every color in the set at once (individual colors can
          still be unchecked afterward).
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, maxWidth: 480 }}>
          <input type="text" placeholder="New palette name, e.g. Excellent Star CP" value={newPaletteName} onChange={(e) => setNewPaletteName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPalette()} />
          <button className="btn" onClick={addPalette} style={{ whiteSpace: 'nowrap' }}>Add palette</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560 }}>
          {palettes.map((p) => (
            <div key={p.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ fontSize: 14 }}>{p.name}</strong>
                <button className="btn-ghost" style={{ fontSize: 11, color: '#a3341f' }} onClick={() => removePalette(p.id)}>Delete</button>
              </div>
              <MultiSelect
                options={colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex_value, refPhotoUrl: c.ref_photo_url }))}
                selectedIds={p.colorIds}
                onToggle={(colorId, active) => togglePaletteColor(p.id, colorId, active)}
                leading="swatch"
                placeholder="No colors in this palette yet"
              />
            </div>
          ))}
          {palettes.length === 0 && <p style={{ fontSize: 13, color: '#756e5c' }}>No palettes yet -- add one above.</p>}
        </div>
      </section>
    </>
  );
}

function NameCell({ value, onSave }: { value: string; onSave: (name: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  async function save() {
    const trimmed = text.trim();
    if (!trimmed || trimmed === value) {
      setText(value);
      setEditing(false);
      return;
    }
    setEditing(false);
    await onSave(trimmed);
  }

  if (!editing) {
    return (
      <span
        onClick={() => { setText(value); setEditing(true); }}
        style={{ cursor: 'pointer', borderBottom: '1px dashed var(--line)', fontSize: 13.5 }}
        title="Click to rename"
      >
        {value}
      </span>
    );
  }

  return (
    <input
      autoFocus
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') { setText(value); setEditing(false); }
      }}
      style={{ fontSize: 13, padding: '3px 6px', maxWidth: 180 }}
    />
  );
}
