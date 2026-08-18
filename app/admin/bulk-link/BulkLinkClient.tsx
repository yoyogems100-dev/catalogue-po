'use client';

import { useState } from 'react';
import MultiSelect from '@/components/MultiSelect';

type Shape = { id: number; name: string };
type ColorRow = { id: number; name: string; hex_value: string | null };
type Category = { id: number; num: number; name: string };

export default function BulkLinkClient({
  shapes,
  colors,
  categories
}: {
  shapes: Shape[];
  colors: ColorRow[];
  categories: Category[];
}) {
  const [shapeIds, setShapeIds] = useState<number[]>([]);
  const [colorIds, setColorIds] = useState<number[]>([]);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');

  async function link() {
    if (categoryIds.length === 0 || (shapeIds.length === 0 && colorIds.length === 0)) {
      setResult('Pick at least one category and at least one shape or color.');
      return;
    }
    setBusy(true);
    setResult('');
    const res = await fetch('/api/category-links/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryIds, shapeIds, colorIds })
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setResult(data.error || 'Failed to link.');
      return;
    }
    setResult(
      `Linked ${data.shapesLinked} shape(s) and ${data.colorsLinked} color(s) to ${data.categoriesAffected} categor${data.categoriesAffected === 1 ? 'y' : 'ies'}. Already-linked pairs were left as-is.`
    );
  }

  return (
    <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <label className="po-label">Categories</label>
        <MultiSelect
          options={categories.map((c) => ({ id: c.id, name: c.name }))}
          selectedIds={categoryIds}
          onToggle={(id, active) => setCategoryIds(active ? categoryIds.filter((x) => x !== id) : [...categoryIds, id])}
          placeholder="Choose categories to link into"
        />
      </div>
      <div>
        <label className="po-label">Shapes (optional)</label>
        <MultiSelect
          options={shapes.map((s) => ({ id: s.id, name: s.name }))}
          selectedIds={shapeIds}
          onToggle={(id, active) => setShapeIds(active ? shapeIds.filter((x) => x !== id) : [...shapeIds, id])}
          placeholder="Choose shapes to link"
        />
      </div>
      <div>
        <label className="po-label">Colors (optional)</label>
        <MultiSelect
          options={colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex_value }))}
          selectedIds={colorIds}
          onToggle={(id, active) => setColorIds(active ? colorIds.filter((x) => x !== id) : [...colorIds, id])}
          leading="swatch"
          placeholder="Choose colors to link"
        />
      </div>

      <button type="button" className="btn" onClick={link} disabled={busy} style={{ width: 'fit-content' }}>
        {busy ? 'Linking...' : `Link ${shapeIds.length + colorIds.length || ''} item(s) to ${categoryIds.length || ''} categor${categoryIds.length === 1 ? 'y' : 'ies'}`}
      </button>

      {result && <p style={{ fontSize: 13, color: result.includes('Failed') || result.includes('Pick') ? '#a3341f' : '#1a6b3a' }}>{result}</p>}
    </div>
  );
}
