'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ShapeIcon from '@/components/ShapeIcon';
import ShapeReferenceImage from '@/components/ShapeReferenceImage';
import ColorSwatch from '@/components/ColorSwatch';
import { confirmAction } from '@/components/admin/AdminDialogs';

// Semi Precious Beads' own shapes, sizes and materials, in one place: the
// materials never appear on the shared Colors page, and every name here
// belongs to this category alone, so renaming one changes nothing elsewhere.

type Shape = { id: number; name: string; iconKey: string | null; refPhotoUrl: string | null; owned: boolean };
type Size = { id: number; shapeId: number; sizeMm: string };
type Material = { id: number; name: string; refPhotoUrl: string | null };

export default function CategoryMaterialsManager({
  categoryId,
  label,
  shapes,
  sizes,
  materials,
  availability
}: {
  categoryId: number;
  /** What buyers see instead of "Color", e.g. "Material". */
  label: string;
  shapes: Shape[];
  sizes: Size[];
  materials: Material[];
  /** [shape_size_id, color_id] pairs. */
  availability: [number, number][];
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [ticks, setTicks] = useState(() => new Set(availability.map(([s, c]) => `${s}:${c}`)));
  useEffect(() => setTicks(new Set(availability.map(([s, c]) => `${s}:${c}`))), [availability]);
  const [sizeId, setSizeId] = useState<number | null>(sizes[0]?.id ?? null);
  useEffect(() => { if (!sizes.some((s) => s.id === sizeId)) setSizeId(sizes[0]?.id ?? null); }, [sizes, sizeId]);
  const [newMaterial, setNewMaterial] = useState('');
  const [newShape, setNewShape] = useState('');
  const [newSize, setNewSize] = useState<Record<number, string>>({});
  const [labelText, setLabelText] = useState(label);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(''), 3500);
    return () => clearTimeout(t);
  }, [message]);

  async function call(body: Record<string, unknown>, done?: string): Promise<any | null> {
    setBusy(true);
    const response = await fetch(`/api/admin/categories/${categoryId}/materials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(data.error || 'Could not save.');
      return null;
    }
    if (done) setMessage(done);
    router.refresh();
    return data;
  }

  async function upload(url: string, fields: Record<string, string>, file: File | undefined, done: string) {
    if (!file) return;
    const body = new FormData();
    Object.entries(fields).forEach(([k, v]) => body.append(k, v));
    body.append('file', file);
    setBusy(true);
    const response = await fetch(url, { method: url.endsWith('/materials') ? 'PUT' : 'POST', body });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setMessage(data.error || 'Could not upload this photo.'); return; }
    setMessage(done);
    router.refresh();
  }

  async function toggle(colorId: number) {
    if (sizeId === null) return;
    const key = `${sizeId}:${colorId}`;
    const on = !ticks.has(key);
    setTicks((cur) => { const next = new Set(cur); if (on) next.add(key); else next.delete(key); return next; });
    const ok = await call({ action: 'set_availability', id: sizeId, colorId, on });
    if (!ok) setTicks((cur) => { const next = new Set(cur); if (on) next.delete(key); else next.add(key); return next; });
  }

  const shapeName = (id: number) => shapes.find((s) => s.id === id)?.name || 'Shape';
  const sizeCount = useMemo(() => {
    const counts: Record<number, number> = {};
    ticks.forEach((key) => { const colorId = Number(key.split(':')[1]); counts[colorId] = (counts[colorId] || 0) + 1; });
    return counts;
  }, [ticks]);
  const tickedHere = sizeId === null ? 0 : materials.filter((m) => ticks.has(`${sizeId}:${m.id}`)).length;
  const visibleMaterials = materials.filter((m) => m.name.toLowerCase().includes(filter.trim().toLowerCase()));
  const lower = label.toLowerCase();

  return (
    <div className="materials-manager">
      <section className="shape-reference-manager" aria-labelledby="materials-shapes-title">
        <div className="shape-reference-manager-head">
          <h3 id="materials-shapes-title">Shapes &amp; sizes</h3>
          <p>Only this category uses these shapes. Tap a name to rename it. Type a size (e.g. 6 or 8x8) and press Enter to add it; &times; removes it. The photo shows beside the shape in the buyer&rsquo;s dropdown.</p>
        </div>
        <div className="shape-reference-admin-grid">
          {shapes.map((shape) => (
            <article className="shape-reference-admin-row materials-shape-row" key={shape.id}>
              <div className="shape-reference-admin-preview" aria-hidden="true">
                {shape.refPhotoUrl
                  ? <ShapeReferenceImage name={shape.name} src={shape.refPhotoUrl} iconKey={shape.iconKey} fallbackSize={38} />
                  : <ShapeIcon iconKey={shape.iconKey} size={42} />}
              </div>
              <div className="shape-reference-admin-copy">
                {shape.owned
                  ? <InlineName value={shape.name} what="shape" onSave={(name) => call({ action: 'rename_shape', id: shape.id, name }, 'Shape renamed.')} />
                  : <strong>{shape.name}</strong>}
                <div className="materials-size-chips">
                  <span className="materials-size-label">Sizes</span>
                  {sizes.filter((s) => s.shapeId === shape.id).map((s) => (
                    <span className="materials-size-chip" key={s.id}>
                      {s.sizeMm} mm
                      {shape.owned && <button type="button" aria-label={`Delete size ${s.sizeMm} mm from ${shape.name}`} disabled={busy}
                        onClick={() => { void confirmAction(`Delete ${s.sizeMm} mm from ${shape.name}? Its ${lower} ticks go too.`).then((ok) => { if (ok) call({ action: 'delete_size', id: s.id }, 'Size deleted.'); }); }}>×</button>}
                    </span>
                  ))}
                  {shape.owned && (
                    <form className="materials-size-add" onSubmit={async (e) => {
                      e.preventDefault();
                      const ok = await call({ action: 'add_size', id: shape.id, sizeMm: newSize[shape.id] || '' }, 'Size added.');
                      if (ok) { setNewSize((cur) => ({ ...cur, [shape.id]: '' })); setSizeId(ok.id); }
                    }}>
                      <input aria-label={`New size for ${shape.name}`} placeholder="+ size" value={newSize[shape.id] || ''} onChange={(e) => setNewSize((cur) => ({ ...cur, [shape.id]: e.target.value }))} />
                    </form>
                  )}
                </div>
                <span>{(() => {
                  const n = sizes.filter((s) => s.shapeId === shape.id).length;
                  return n === 0 ? 'No size yet: buyers can\u2019t order this shape.'
                    : n === 1 ? 'One size: buyers get it automatically, read-only.'
                    : `${n} sizes: buyers choose from a dropdown.`;
                })()}</span>
              </div>
              <div className="shape-reference-admin-actions">
                <label className="shape-reference-upload">
                  {shape.refPhotoUrl ? 'Replace photo' : 'Add photo'}
                  <input type="file" accept="image/png,image/webp,image/jpeg" disabled={busy}
                    onChange={(e) => { upload(`/api/admin/categories/${categoryId}/shape-reference`, { shape_id: String(shape.id) }, e.target.files?.[0], 'Shape photo saved.'); e.currentTarget.value = ''; }} />
                </label>
                {shape.owned && <button type="button" className="materials-link-danger" disabled={busy}
                  onClick={() => { void confirmAction(`Delete the shape ${shape.name} and its sizes?`).then((ok) => { if (ok) call({ action: 'delete_shape', id: shape.id }, 'Shape deleted.'); }); }}>Delete</button>}
              </div>
            </article>
          ))}
        </div>
        <form className="materials-add-row" onSubmit={async (e) => {
          e.preventDefault();
          if (await call({ action: 'add_shape', name: newShape }, 'Shape added. Now add its sizes.')) setNewShape('');
        }}>
          <input aria-label="New shape name" placeholder="New shape name" value={newShape} onChange={(e) => setNewShape(e.target.value)} />
          <button type="submit" className="btn-ghost" disabled={busy || !newShape.trim()}>Add shape</button>
        </form>
      </section>

      <section className="shape-reference-manager" aria-labelledby="materials-list-title">
        <div className="shape-reference-manager-head">
          <h3 id="materials-list-title">{label}s ({materials.length})</h3>
          <p>Tap a name to rename it. The photo shows beside the name in the buyer&rsquo;s dropdown. These stay off the shared Colors page.</p>
        </div>
        {materials.length > 12 && <input className="materials-filter" type="search" aria-label={`Search ${lower}s`} placeholder={`Search ${lower}s`} value={filter} onChange={(e) => setFilter(e.target.value)} />}
        <div className="shape-reference-admin-grid">
          {visibleMaterials.map((m) => (
            <article className="shape-reference-admin-row" key={m.id}>
              <div className="shape-reference-admin-preview" aria-hidden="true">
                {m.refPhotoUrl ? <img src={m.refPhotoUrl} alt="" loading="lazy" /> : <span className="materials-no-photo">No photo</span>}
              </div>
              <div className="shape-reference-admin-copy">
                <InlineName value={m.name} what={lower} onSave={(name) => call({ action: 'rename_material', id: m.id, name }, `${label} renamed.`)} />
                <span>{sizeCount[m.id] ? `In ${sizeCount[m.id]} shape/size${sizeCount[m.id] === 1 ? '' : 's'}` : 'Not ticked for any shape yet'}</span>
              </div>
              <div className="shape-reference-admin-actions">
                <label className="shape-reference-upload">
                  {m.refPhotoUrl ? 'Replace photo' : 'Add photo'}
                  <input type="file" accept="image/png,image/webp,image/jpeg" disabled={busy}
                    onChange={(e) => { upload(`/api/admin/categories/${categoryId}/materials`, { color_id: String(m.id) }, e.target.files?.[0], `${label} photo saved.`); e.currentTarget.value = ''; }} />
                </label>
                {m.refPhotoUrl && <button type="button" className="materials-link" disabled={busy} onClick={() => call({ action: 'remove_material_photo', id: m.id }, 'Photo removed.')}>Remove photo</button>}
                <button type="button" className="materials-link-danger" disabled={busy}
                  onClick={() => { void confirmAction(`Delete ${m.name}?`).then((ok) => { if (ok) call({ action: 'delete_material', id: m.id }, `${label} deleted.`); }); }}>Delete</button>
              </div>
            </article>
          ))}
        </div>
        <form className="materials-add-row" onSubmit={async (e) => {
          e.preventDefault();
          const ok = await call({ action: 'add_material', name: newMaterial }, `${label} added. Tick it below for the shapes that carry it.`);
          if (ok) setNewMaterial('');
        }}>
          <input aria-label={`New ${lower} name`} placeholder={`New ${lower} name`} value={newMaterial} onChange={(e) => setNewMaterial(e.target.value)} />
          <button type="submit" className="btn-ghost" disabled={busy || !newMaterial.trim()}>Add {lower}</button>
        </form>
      </section>

      <section className="shape-reference-manager" aria-labelledby="materials-availability-title">
        <div className="shape-reference-manager-head">
          <h3 id="materials-availability-title">Which {lower}s each shape comes in</h3>
          <p>Buyers only see the ticked {lower}s after choosing this shape and size.</p>
        </div>
        {sizes.length === 0 ? <p className="materials-empty">Add a shape and a size first.</p> : <>
          <label className="po-label" htmlFor="materials-size-pick">Shape &amp; size</label>
          <select id="materials-size-pick" className="materials-size-pick" value={sizeId ?? ''} onChange={(e) => setSizeId(Number(e.target.value))}>
            {sizes.map((s) => {
              const n = materials.filter((m) => ticks.has(`${s.id}:${m.id}`)).length;
              return <option key={s.id} value={s.id}>{shapeName(s.shapeId)} · {s.sizeMm} mm ({n})</option>;
            })}
          </select>
          <p className="materials-count" role="status">{tickedHere} of {materials.length} ticked</p>
          <div className="materials-ticks">
            {materials.map((m) => {
              const on = sizeId !== null && ticks.has(`${sizeId}:${m.id}`);
              return (
                <button type="button" key={m.id} className={`materials-tick${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle(m.id)}>
                  <ColorSwatch refPhotoUrl={m.refPhotoUrl} name={m.name} size={18} />
                  <span>{m.name}</span>
                </button>
              );
            })}
          </div>
        </>}
      </section>

      <section className="shape-reference-manager" aria-labelledby="materials-label-title">
        <div className="shape-reference-manager-head">
          <h3 id="materials-label-title">Field name buyers see</h3>
          <p>Shown instead of &ldquo;Color&rdquo; on this category&rsquo;s order form.</p>
        </div>
        <form className="materials-add-row" onSubmit={(e) => { e.preventDefault(); call({ action: 'set_label', label: labelText }, 'Field name saved.'); }}>
          <input aria-label="Field name" value={labelText} maxLength={40} onChange={(e) => setLabelText(e.target.value)} />
          <button type="submit" className="btn-ghost" disabled={busy || !labelText.trim() || labelText.trim() === label}>Save</button>
        </form>
      </section>

      {message && <p className="po-toast" role="status" aria-live="polite">{message}</p>}
    </div>
  );
}

function InlineName({ value, what, onSave }: { value: string; what: string; onSave: (name: string) => Promise<unknown> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  async function save() {
    const trimmed = text.trim();
    setEditing(false);
    if (!trimmed || trimmed === value) { setText(value); return; }
    const ok = await onSave(trimmed);
    if (!ok) setText(value);
  }

  if (!editing) {
    return (
      <button type="button" className="materials-name" onClick={() => setEditing(true)} aria-label={`Rename ${what} ${value}`} title="Tap to rename">
        {text}
      </button>
    );
  }
  return (
    <input
      autoFocus
      className="materials-name-input"
      aria-label={`${what} name`}
      value={text}
      maxLength={80}
      onChange={(e) => setText(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') { setText(value); setEditing(false); }
      }}
    />
  );
}
