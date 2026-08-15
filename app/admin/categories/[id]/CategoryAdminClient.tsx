'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import MultiSelect from '@/components/MultiSelect';
import ShapeSizeSelect from '@/components/ShapeSizeSelect';

type Ref = { id: number; name: string };
type ColorRef = Ref & { hexValue?: string | null };
type ShapeRef = Ref & { iconKey?: string | null };
type Tag = Ref & { is_global: boolean };
type Size = { id: number; shape_id: number; size_mm: string; weight_ct: number | null };
type Photo = {
  id: number;
  url: string | null;
  shape_id: number | null;
  shape_size_id: number | null;
  color_id: number | null;
  product_code: string | null;
  notes: string | null;
  tag_ids: number[];
};

export default function CategoryAdminClient({
  categoryId,
  allShapes,
  allColors,
  allTags,
  allSizes,
  linkedShapeIds,
  linkedColorIds,
  linkedTagIds,
  linkedSizeIds,
  thumbnailPhotoId,
  photos
}: {
  categoryId: number;
  allShapes: ShapeRef[];
  allColors: ColorRef[];
  allTags: Tag[];
  allSizes: Size[];
  linkedShapeIds: number[];
  linkedColorIds: number[];
  linkedTagIds: number[];
  linkedSizeIds: number[];
  thumbnailPhotoId: number | null;
  photos: Photo[];
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [driveText, setDriveText] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function toggleLink(kind: 'shape' | 'color' | 'tag', id: number, currentlyLinked: boolean) {
    const key = kind === 'shape' ? 'shape_id' : kind === 'color' ? 'color_id' : 'tag_id';
    const res = await fetch(`/api/category-links/${kind}`, {
      method: currentlyLinked ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId, [key]: id })
    });
    if (!res.ok) throw new Error('Failed to update link');
    router.refresh();
  }

  async function toggleSize(sizeId: number, currentlyLinked: boolean) {
    const res = await fetch('/api/category-links/size', {
      method: currentlyLinked ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId, shape_size_id: sizeId })
    });
    if (!res.ok) throw new Error('Failed to update link');
    router.refresh();
  }

  async function setAllSizesForShape(shapeId: number, sizeIds: number[]) {
    await fetch('/api/category-links/size/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId, shape_id: shapeId, shape_size_ids: sizeIds })
    });
    router.refresh();
  }

  async function createTag(global: boolean) {
    if (!newTagName.trim()) return;
    await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTagName, is_global: global, category_id: global ? undefined : categoryId })
    });
    setNewTagName('');
    router.refresh();
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category_id', String(categoryId));
      await fetch('/api/photos/upload', { method: 'POST', body: fd });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    router.refresh();
  }

  function extractDriveIds(text: string) {
    return text
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const m = s.match(/\/d\/([a-zA-Z0-9_-]{20,})/) || s.match(/id=([a-zA-Z0-9_-]{20,})/);
        return m ? m[1] : /^[a-zA-Z0-9_-]{20,}$/.test(s) ? s : null;
      })
      .filter(Boolean) as string[];
  }

  async function importDrive() {
    const ids = extractDriveIds(driveText);
    if (ids.length === 0) return;
    setImporting(true);
    await fetch('/api/photos/import-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId, drive_ids: ids })
    });
    setImporting(false);
    setDriveText('');
    router.refresh();
  }

  async function updatePhoto(photoId: number, patch: Partial<Pick<Photo, 'shape_id' | 'shape_size_id' | 'color_id' | 'product_code' | 'notes'>>, tagIds?: number[]) {
    await fetch('/api/photos/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: photoId, ...patch, tag_ids: tagIds })
    });
    router.refresh();
  }

  async function deletePhoto(photoId: number) {
    if (!confirm('Delete this photo?')) return;
    await fetch('/api/photos/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: photoId }) });
    router.refresh();
  }

  async function setThumbnail(photoId: number) {
    await fetch('/api/categories/set-thumbnail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId, photo_id: photoId })
    });
    router.refresh();
  }

  async function movePhoto(photoId: number, direction: 'left' | 'right') {
    await fetch('/api/photos/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId, photo_id: photoId, direction })
    });
    router.refresh();
  }

  return (
    <div style={{ marginTop: 20 }}>
      {/* Shapes+sizes, Colors, Tags -- all compact dropdowns in one row to minimize page scroll */}
      <section style={{ marginBottom: 24 }}>
        <div className="link-row">
          <div>
            <h3 className="section-label">Shapes &amp; sizes</h3>
            <ShapeSizeSelect
              allShapes={allShapes}
              allSizes={allSizes}
              linkedShapeIds={linkedShapeIds}
              linkedSizeIds={linkedSizeIds}
              onToggleShape={(id, active) => toggleLink('shape', id, active)}
              onToggleSize={toggleSize}
              onBulkSizes={setAllSizesForShape}
            />
          </div>
          <div>
            <h3 className="section-label">Colors</h3>
            <MultiSelect
              options={allColors.map((c) => ({ id: c.id, name: c.name, hex: c.hexValue }))}
              selectedIds={linkedColorIds}
              onToggle={(id, active) => toggleLink('color', id, active)}
              leading="swatch"
              placeholder="No colors selected"
            />
          </div>
          <div>
            <h3 className="section-label">Tags</h3>
            <MultiSelect
              options={allTags.map((t) => ({ id: t.id, name: t.name }))}
              selectedIds={linkedTagIds}
              onToggle={(id, active) => toggleLink('tag', id, active)}
              placeholder="No tags selected"
            />
            <div className="tag-create-row">
              <input type="text" placeholder="New tag" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} style={{ fontSize: 12.5 }} />
              <button className="btn-ghost" style={{ fontSize: 11, whiteSpace: 'nowrap' }} onClick={() => createTag(false)}>Here only</button>
              <button className="btn" style={{ fontSize: 11, whiteSpace: 'nowrap' }} onClick={() => createTag(true)}>Global</button>
            </div>
          </div>
        </div>
      </section>

      {/* Upload */}
      <section style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Upload photos</h3>
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => handleUpload(e.target.files)} />
        {uploading && <span style={{ marginLeft: 10, fontSize: 12.5 }}>Uploading…</span>}
      </section>

      {/* Bulk Drive import */}
      <section style={{ marginBottom: 30 }}>
        <h3 style={{ fontSize: 14, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Or bulk-import from Google Drive</h3>
        <p style={{ fontSize: 12.5, color: '#8a8370', marginBottom: 8 }}>Paste Drive share links or file IDs, one per line -- no re-upload needed.</p>
        <textarea rows={3} style={{ maxWidth: 480 }} value={driveText} onChange={(e) => setDriveText(e.target.value)} />
        <div style={{ marginTop: 8 }}>
          <button className="btn" onClick={importDrive} disabled={importing}>{importing ? 'Importing…' : 'Import'}</button>
        </div>
      </section>

      {/* Photo grid with per-photo tagging */}
      <section>
        <h3 style={{ fontSize: 14, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>{photos.length} photos</h3>
        <p style={{ fontSize: 12, color: '#8a8370', marginBottom: 12 }}>
          "Set cover" picks which photo represents this category on the homepage. Use ← / → to reorder how photos appear here and on the public page.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {photos.map((p, i) => (
            <PhotoRow
              key={p.id}
              photo={p}
              index={i}
              total={photos.length}
              isThumbnail={thumbnailPhotoId === p.id}
              shapes={allShapes.filter((s) => linkedShapeIds.includes(s.id))}
              colors={allColors.filter((c) => linkedColorIds.includes(c.id))}
              tags={allTags.filter((t) => linkedTagIds.includes(t.id))}
              sizes={allSizes.filter((sz) => linkedSizeIds.includes(sz.id))}
              onUpdate={updatePhoto}
              onDelete={deletePhoto}
              onSetThumbnail={setThumbnail}
              onMove={movePhoto}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function PhotoRow({
  photo,
  index,
  total,
  isThumbnail,
  shapes,
  colors,
  tags,
  sizes,
  onUpdate,
  onDelete,
  onSetThumbnail,
  onMove
}: {
  photo: Photo;
  index: number;
  total: number;
  isThumbnail: boolean;
  shapes: Ref[];
  colors: Ref[];
  tags: Tag[];
  sizes: Size[];
  onUpdate: (id: number, patch: Partial<Photo>, tagIds?: number[]) => void;
  onDelete: (id: number) => void;
  onSetThumbnail: (id: number) => void;
  onMove: (id: number, direction: 'left' | 'right') => void;
}) {
  const [shapeId, setShapeId] = useState(photo.shape_id ?? '');
  const [sizeId, setSizeId] = useState(photo.shape_size_id ?? '');
  const [colorId, setColorId] = useState(photo.color_id ?? '');
  const [tagIds, setTagIds] = useState<number[]>(photo.tag_ids);
  const [productCode, setProductCode] = useState(photo.product_code || '');
  const [notes, setNotes] = useState(photo.notes || '');

  const availableSizes = sizes.filter((s) => String(s.shape_id) === String(shapeId));

  function toggleTag(id: number) {
    const next = tagIds.includes(id) ? tagIds.filter((t) => t !== id) : [...tagIds, id];
    setTagIds(next);
    onUpdate(photo.id, {}, next);
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ aspectRatio: '1/1', background: '#eee', position: 'relative' }}>
        {photo.url && <img src={photo.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        {isThumbnail && (
          <span style={{ position: 'absolute', top: 6, left: 6, background: 'var(--gold)', color: '#fff', fontSize: 10, padding: '3px 7px', letterSpacing: 0.5 }}>
            COVER
          </span>
        )}
        {photo.product_code && (
          <span style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(18,35,63,0.85)', color: '#fff', fontSize: 10, padding: '3px 7px', letterSpacing: 0.3, fontFamily: 'monospace' }}>
            {photo.product_code}
          </span>
        )}
      </div>
      <div style={{ padding: 10 }}>
        <div className="photo-controls">
          <button onClick={() => onMove(photo.id, 'left')} disabled={index === 0}>&larr;</button>
          <button className={isThumbnail ? 'active-thumb' : ''} onClick={() => onSetThumbnail(photo.id)}>{isThumbnail ? 'Cover ✓' : 'Set cover'}</button>
          <button onClick={() => onMove(photo.id, 'right')} disabled={index === total - 1}>&rarr;</button>
        </div>
        <select
          value={shapeId}
          onChange={(e) => { const v = e.target.value ? Number(e.target.value) : ''; setShapeId(v); setSizeId(''); onUpdate(photo.id, { shape_id: v || null, shape_size_id: null }); }}
          style={{ marginBottom: 6, fontSize: 12 }}
        >
          <option value="">No shape</option>
          {shapes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          value={sizeId}
          onChange={(e) => { const v = e.target.value ? Number(e.target.value) : ''; setSizeId(v); onUpdate(photo.id, { shape_size_id: v || null }); }}
          style={{ marginBottom: 6, fontSize: 12 }}
          disabled={!shapeId}
        >
          <option value="">No size</option>
          {availableSizes.map((s) => <option key={s.id} value={s.id}>{s.size_mm} mm</option>)}
        </select>
        <select
          value={colorId}
          onChange={(e) => { const v = e.target.value ? Number(e.target.value) : ''; setColorId(v); onUpdate(photo.id, { color_id: v || null }); }}
          style={{ marginBottom: 8, fontSize: 12 }}
        >
          <option value="">No color</option>
          {colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input
          type="text"
          placeholder="Product code"
          value={productCode}
          onChange={(e) => setProductCode(e.target.value)}
          onBlur={() => onUpdate(photo.id, { product_code: productCode })}
          style={{ marginBottom: 6, fontSize: 12 }}
        />
        <input
          type="text"
          placeholder="Additional note"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => onUpdate(photo.id, { notes })}
          style={{ marginBottom: 8, fontSize: 12 }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {tags.map((t) => (
            <span
              key={t.id}
              className={`tag-chip ${tagIds.includes(t.id) ? 'active' : ''}`}
              style={{ cursor: 'pointer', fontSize: 11 }}
              onClick={() => toggleTag(t.id)}
            >
              {t.name}
            </span>
          ))}
        </div>
        <button className="btn-danger" style={{ width: '100%' }} onClick={() => onDelete(photo.id)}>Delete photo</button>
      </div>
    </div>
  );
}
