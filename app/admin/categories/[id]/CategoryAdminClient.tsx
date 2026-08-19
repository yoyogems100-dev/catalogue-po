'use client';

import { useEffect, useRef, useState } from 'react';
import type { HTMLAttributes } from 'react';
import { useRouter } from 'next/navigation';
import MultiSelect from '@/components/MultiSelect';
import IconSelect from '@/components/IconSelect';
import ShapeSizeSelect from '@/components/ShapeSizeSelect';
import { useDragReorder, moveItem } from '@/hooks/useDragReorder';

type Ref = { id: number; name: string };
type ColorRef = Ref & { hexValue?: string | null };
type ShapeRef = Ref & { iconKey?: string | null };
type Tag = Ref & { is_global: boolean };
type Size = { id: number; shape_id: number; size_mm: string; weight_ct: number | null };
type Photo = {
  id: number;
  url: string | null;
  shapeIds: number[];
  sizeIds: number[];
  colorIds: number[];
  product_code: string | null;
  notes: string | null;
  tag_ids: number[];
  isCoverOnly: boolean;
};

type BadgeType = 'shapes' | 'colors' | 'sizes';
const BADGE_OPTIONS: { value: BadgeType; label: string }[] = [
  { value: 'shapes', label: 'Shapes' },
  { value: 'colors', label: 'Colors' },
  { value: 'sizes', label: 'Sizes' }
];

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
  photos,
  colorPalettes,
  badgeTypes
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
  colorPalettes?: { id: number; name: string; memberIds: number[] }[];
  badgeTypes: BadgeType[];
}) {
  const router = useRouter();
  const [expandedSummary, setExpandedSummary] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [driveText, setDriveText] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [localBadgeTypes, setLocalBadgeTypes] = useState<BadgeType[]>(badgeTypes);

  const [localPhotos, setLocalPhotos] = useState(photos);
  useEffect(() => setLocalPhotos(photos), [photos]);

  // The gallery grid (and the photo count/Explore Photos) never includes a
  // dedicated cover-only upload -- it's a distinct image, not a catalogue
  // stone. The cover photo itself is whichever photo is the thumbnail,
  // cover-only or not.
  const galleryPhotos = localPhotos.filter((p) => !p.isCoverOnly);
  const coverPhoto = localPhotos.find((p) => p.id === thumbnailPhotoId) || null;

  const { dragHandleProps, dropTargetProps, dragIndex, overIndex } = useDragReorder(async (from, to) => {
    const prevAll = localPhotos;
    const next = moveItem(galleryPhotos, from, to);
    const coverOnly = localPhotos.filter((p) => p.isCoverOnly);
    setLocalPhotos([...next, ...coverOnly]);
    const res = await fetch('/api/photos/reorder-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId, orderedIds: next.map((p) => p.id) })
    });
    if (!res.ok) {
      setLocalPhotos(prevAll);
      alert('Failed to save the new photo order.');
      return;
    }
    router.refresh();
  });

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
    // Always pass categoryId -- a tag created while looking at a category
    // should be linked here regardless of whether it's also global (usable
    // elsewhere) or category-specific (usable only here).
    await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTagName, is_global: global, category_id: categoryId })
    });
    setNewTagName('');
    router.refresh();
  }

  // "Other" free text on a photo's tag field creates a real category-scoped
  // tag (so it's reusable on other photos too, same list the Tags dropdown
  // pulls from) and returns it so the caller can attach it to that photo
  // immediately, without waiting on the router.refresh() round trip.
  async function createPhotoTag(name: string): Promise<{ id: number; name: string } | null> {
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, is_global: false, category_id: categoryId })
    });
    if (!res.ok) return null;
    const tag = await res.json();
    router.refresh();
    return tag;
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

  async function toggleBadgeType(type: BadgeType) {
    const next = localBadgeTypes.includes(type) ? localBadgeTypes.filter((t) => t !== type) : [...localBadgeTypes, type];
    setLocalBadgeTypes(next);
    const res = await fetch('/api/categories', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: categoryId, badge_types: next })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to update tags');
    }
    router.refresh();
  }

  // A dedicated cover photo -- doesn't need to be a real stone in the
  // catalogue, so it's excluded from Explore Photos and the photo count,
  // and it's auto-set as the thumbnail as soon as it uploads.
  async function handleCoverUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingCover(true);
    const fd = new FormData();
    fd.append('file', files[0]);
    fd.append('category_id', String(categoryId));
    fd.append('is_cover_only', 'true');
    await fetch('/api/photos/upload', { method: 'POST', body: fd });
    setUploadingCover(false);
    if (coverInputRef.current) coverInputRef.current.value = '';
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

  async function updatePhoto(
    photoId: number,
    patch: { shapeIds?: number[]; sizeIds?: number[]; colorIds?: number[]; product_code?: string; notes?: string },
    tagIds?: number[]
  ) {
    await fetch('/api/photos/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: photoId,
        shape_ids: patch.shapeIds,
        shape_size_ids: patch.sizeIds,
        color_ids: patch.colorIds,
        product_code: patch.product_code,
        notes: patch.notes,
        tag_ids: tagIds
      })
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

  const linkedShapes = allShapes.filter((s) => linkedShapeIds.includes(s.id));
  const linkedColors = allColors.filter((c) => linkedColorIds.includes(c.id));
  const linkedSizes = allSizes.filter((sz) => linkedSizeIds.includes(sz.id));
  const linkedTags = allTags.filter((t) => linkedTagIds.includes(t.id));

  function toggleSummary(key: string) {
    setExpandedSummary((cur) => ({ ...cur, [key]: !cur[key] }));
  }

  const summaryBlocks: { key: string; label: string; count: number; text: string }[] = [
    { key: 'shapes', label: 'Shape', count: linkedShapes.length, text: linkedShapes.map((s) => s.name).join(', ') },
    { key: 'colors', label: 'Color', count: linkedColors.length, text: linkedColors.map((c) => c.name).join(', ') },
    {
      key: 'sizes',
      label: 'Size',
      count: linkedSizes.length,
      text: linkedSizes.map((sz) => `${sz.size_mm}mm (${allShapes.find((s) => s.id === sz.shape_id)?.name || '—'})`).join(', ')
    },
    { key: 'tags', label: 'Specification', count: linkedTags.length, text: linkedTags.map((t) => t.name).join(', ') }
  ];

  return (
    <div style={{ marginTop: 20 }}>
      {/* At-a-glance summary of everything linked to this category -- collapsed to just
          the counts by default (the full name lists were overwhelming at a glance on
          categories with dozens of shapes/colors/sizes), click a count to expand it. */}
      <section className="cat-summary-panel" style={{ marginBottom: 20 }}>
        {summaryBlocks.map((b) => {
          const expanded = !!expandedSummary[b.key];
          return (
            <div key={b.key}>
              <button
                type="button"
                className="cat-summary-label cat-summary-toggle"
                onClick={() => toggleSummary(b.key)}
                disabled={b.count === 0}
              >
                {b.count} {b.label}{b.count === 1 ? '' : 's'} {b.count > 0 && (expanded ? '▲' : '▼')}
              </button>
              {expanded && <p className="cat-summary-value">{b.count ? b.text : 'None linked yet'}</p>}
            </div>
          );
        })}
      </section>

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
              palettes={colorPalettes}
            />
          </div>
          <div>
            <h3 className="section-label">Specifications</h3>
            <MultiSelect
              options={allTags.map((t) => ({ id: t.id, name: t.name }))}
              selectedIds={linkedTagIds}
              onToggle={(id, active) => toggleLink('tag', id, active)}
              placeholder="No specifications selected"
            />
            <div className="tag-create-row">
              <input type="text" placeholder="New specification" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} style={{ fontSize: 12.5 }} />
              <button className="btn-ghost" style={{ fontSize: 11, whiteSpace: 'nowrap' }} onClick={() => createTag(false)}>Here only</button>
              <button className="btn" style={{ fontSize: 11, whiteSpace: 'nowrap' }} onClick={() => createTag(true)}>Global</button>
            </div>
          </div>
        </div>
      </section>

      {/* Cover photo -- can be a dedicated image, not necessarily one of the
          catalogue stones in the gallery below. */}
      <section style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: 14, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Cover photo</h3>
          <input ref={coverInputRef} type="file" accept="image/*" onChange={(e) => handleCoverUpload(e.target.files)} />
          {uploadingCover && <span style={{ fontSize: 12.5 }}>Uploading…</span>}
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11.5, color: '#8a8370' }}>Homepage tags:</span>
            <div className="cat-badge-toggle">
              {BADGE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={localBadgeTypes.includes(o.value) ? 'active' : ''}
                  onClick={() => toggleBadgeType(o.value)}
                  title={`Show ${o.label.toLowerCase()} count on the homepage tile`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </span>
        </div>
        {coverPhoto && (
          <PhotoRow
            photo={coverPhoto}
            index={0}
            total={1}
            isThumbnail
            shapes={allShapes.filter((s) => linkedShapeIds.includes(s.id))}
            colors={allColors.filter((c) => linkedColorIds.includes(c.id))}
            tags={allTags.filter((t) => linkedTagIds.includes(t.id))}
            sizes={allSizes.filter((sz) => linkedSizeIds.includes(sz.id))}
            onUpdate={updatePhoto}
            onDelete={coverPhoto.isCoverOnly ? deletePhoto : undefined}
            onSetThumbnail={setThumbnail}
            onMove={() => {}}
            onCreateTag={createPhotoTag}
            dragHandleProps={{}}
            dropTargetProps={{}}
            isDragging={false}
            isDragOver={false}
            hideMoveControls
            compact
            fieldOptions={['shape', 'color', 'other']}
          />
        )}
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
        <h3 style={{ fontSize: 14, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>{galleryPhotos.length} photos</h3>
        <p style={{ fontSize: 12, color: '#8a8370', marginBottom: 12 }}>
          "Set cover" picks which photo represents this category on the homepage. Drag the &#9776; handle to reorder, or use ← / → -- affects the order on this page and the public site.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {galleryPhotos.map((p, i) => (
            <PhotoRow
              key={p.id}
              photo={p}
              index={i}
              total={galleryPhotos.length}
              isThumbnail={thumbnailPhotoId === p.id}
              shapes={allShapes.filter((s) => linkedShapeIds.includes(s.id))}
              colors={allColors.filter((c) => linkedColorIds.includes(c.id))}
              tags={allTags.filter((t) => linkedTagIds.includes(t.id))}
              sizes={allSizes.filter((sz) => linkedSizeIds.includes(sz.id))}
              onUpdate={updatePhoto}
              onDelete={deletePhoto}
              onSetThumbnail={setThumbnail}
              onMove={movePhoto}
              onCreateTag={createPhotoTag}
              dragHandleProps={dragHandleProps(i)}
              dropTargetProps={dropTargetProps(i)}
              isDragging={dragIndex === i}
              isDragOver={overIndex === i}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

type FieldType = 'shape' | 'size' | 'color' | 'tags' | 'other';

const FIELD_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'shape', label: 'Shape' },
  { value: 'size', label: 'Size' },
  { value: 'color', label: 'Color' },
  { value: 'tags', label: 'Specifications' },
  { value: 'other', label: 'Other' }
];

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
  onMove,
  onCreateTag,
  dragHandleProps,
  dropTargetProps,
  isDragging,
  isDragOver,
  hideMoveControls,
  compact,
  fieldOptions
}: {
  photo: Photo;
  index: number;
  total: number;
  isThumbnail: boolean;
  shapes: ShapeRef[];
  colors: ColorRef[];
  tags: Tag[];
  sizes: Size[];
  onUpdate: (id: number, patch: { shapeIds?: number[]; sizeIds?: number[]; colorIds?: number[]; product_code?: string; notes?: string }, tagIds?: number[]) => void;
  onDelete?: (id: number) => void;
  onSetThumbnail: (id: number) => void;
  onMove: (id: number, direction: 'left' | 'right') => void;
  onCreateTag: (name: string) => Promise<{ id: number; name: string } | null>;
  dragHandleProps: HTMLAttributes<HTMLElement>;
  dropTargetProps: HTMLAttributes<HTMLElement>;
  isDragging: boolean;
  isDragOver: boolean;
  hideMoveControls?: boolean;
  /** Horizontal image-left/controls-right layout, no move/set-cover row --
      used for the dedicated Cover Photo section instead of the gallery grid card. */
  compact?: boolean;
  /** Restrict which Field options are offered -- the cover photo doesn't
      need Size or the full Specifications browse-list, just a quick
      shape/color/other-tag. */
  fieldOptions?: FieldType[];
}) {
  const [shapeIds, setShapeIds] = useState<number[]>(photo.shapeIds);
  const [sizeIds, setSizeIds] = useState<number[]>(photo.sizeIds);
  const [colorIds, setColorIds] = useState<number[]>(photo.colorIds);
  const [tagIds, setTagIds] = useState<number[]>(photo.tag_ids);
  const [productCode, setProductCode] = useState(photo.product_code || '');
  const [notes, setNotes] = useState(photo.notes || '');
  const visibleFieldOptions = fieldOptions ? FIELD_OPTIONS.filter((o) => fieldOptions.includes(o.value)) : FIELD_OPTIONS;
  const [field, setField] = useState<FieldType>(visibleFieldOptions[0]?.value || 'shape');
  const [otherText, setOtherText] = useState('');
  const [creatingTag, setCreatingTag] = useState(false);

  // Union (not intersection) of sizes across every selected shape -- a photo
  // can show more than one shape, and each shape's sizes are still worth
  // offering rather than only the sizes they'd all have in common.
  const availableSizes = sizes.filter((s) => shapeIds.includes(s.shape_id));

  function updateShapes(next: number[]) {
    setShapeIds(next);
    // Drop any selected size that no longer belongs to a still-selected shape.
    const validSizeIds = sizeIds.filter((id) => sizes.some((s) => s.id === id && next.includes(s.shape_id)));
    setSizeIds(validSizeIds);
    onUpdate(photo.id, { shapeIds: next, sizeIds: validSizeIds });
  }

  function updateSizes(next: number[]) {
    setSizeIds(next);
    onUpdate(photo.id, { sizeIds: next });
  }

  function updateColors(next: number[]) {
    setColorIds(next);
    onUpdate(photo.id, { colorIds: next });
  }

  function toggleTag(id: number) {
    const next = tagIds.includes(id) ? tagIds.filter((t) => t !== id) : [...tagIds, id];
    setTagIds(next);
    onUpdate(photo.id, {}, next);
  }

  async function addOtherTag() {
    const name = otherText.trim();
    if (!name) return;
    setCreatingTag(true);
    const tag = await onCreateTag(name);
    setCreatingTag(false);
    if (!tag) return;
    setOtherText('');
    const next = [...tagIds, tag.id];
    setTagIds(next);
    onUpdate(photo.id, {}, next);
  }

  const tagChips = (shapeIds.length > 0 || sizeIds.length > 0 || colorIds.length > 0 || tagIds.length > 0) && (
    <div className="admin-cat-card-tags" style={{ marginBottom: 8 }}>
      {shapeIds.map((id) => {
        const name = shapes.find((s) => s.id === id)?.name;
        return name ? (
          <span key={`sh-${id}`} className="tag-chip-mini">
            {name}
            <span className="tag-chip-mini-x" onClick={() => updateShapes(shapeIds.filter((v) => v !== id))}>&times;</span>
          </span>
        ) : null;
      })}
      {sizeIds.map((id) => {
        const size = sizes.find((s) => s.id === id);
        return size ? (
          <span key={`sz-${id}`} className="tag-chip-mini">
            {size.size_mm}mm
            <span className="tag-chip-mini-x" onClick={() => updateSizes(sizeIds.filter((v) => v !== id))}>&times;</span>
          </span>
        ) : null;
      })}
      {colorIds.map((id) => {
        const name = colors.find((c) => c.id === id)?.name;
        return name ? (
          <span key={`co-${id}`} className="tag-chip-mini">
            {name}
            <span className="tag-chip-mini-x" onClick={() => updateColors(colorIds.filter((v) => v !== id))}>&times;</span>
          </span>
        ) : null;
      })}
      {tagIds.map((id) => {
        const name = tags.find((t) => t.id === id)?.name;
        return name ? (
          <span key={`tg-${id}`} className="tag-chip-mini">
            {name}
            <span className="tag-chip-mini-x" onClick={() => toggleTag(id)}>&times;</span>
          </span>
        ) : null;
      })}
    </div>
  );

  // Field selector + its matching value picker side by side, not stacked.
  const fieldPicker = (
    <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'flex-start' }}>
      <select value={field} onChange={(e) => setField(e.target.value as FieldType)} style={{ fontSize: 12, flex: '0 0 auto', width: 'auto', minWidth: 90 }}>
        {visibleFieldOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <div style={{ flex: 1, minWidth: 0 }}>
        {field === 'shape' && (
          <IconSelect
            multiple
            options={shapes.map((s) => ({ id: s.id, name: s.name, iconKey: s.iconKey }))}
            values={shapeIds}
            onChange={updateShapes}
            placeholder="No shapes"
            leading="icon"
          />
        )}
        {field === 'size' && (
          <IconSelect
            multiple
            options={availableSizes.map((s) => ({ id: s.id, name: `${s.size_mm} mm` }))}
            values={sizeIds}
            onChange={updateSizes}
            placeholder={shapeIds.length === 0 ? 'Pick a shape first' : 'No sizes'}
          />
        )}
        {field === 'color' && (
          <IconSelect
            multiple
            options={colors.map((c) => ({ id: c.id, name: c.name, hex: c.hexValue }))}
            values={colorIds}
            onChange={updateColors}
            placeholder="No colors"
            leading="swatch"
          />
        )}
        {field === 'tags' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {tags.length === 0 && <span style={{ fontSize: 11, color: '#8a8370' }}>No specifications on this category yet -- add one via "Other".</span>}
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
        )}
        {field === 'other' && (
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              placeholder="New specification, e.g. Brilliant Cut"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addOtherTag()}
              style={{ fontSize: 12 }}
            />
            <button className="btn-ghost photo-add-spec-btn" onClick={addOtherTag} disabled={creatingTag} title="Add specification">
              {creatingTag ? '…' : '+'}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (compact) {
    return (
      <div className="card" style={{ display: 'flex', gap: 12, padding: 10 }}>
        <div style={{ width: 110, height: 110, flexShrink: 0, position: 'relative', background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
          {photo.url && <img src={photo.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {tagChips}
          {fieldPicker}
          {onDelete && (
            <button className="btn-ghost" style={{ fontSize: 11, color: '#a3341f' }} onClick={() => onDelete(photo.id)}>
              Remove cover photo
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`card ${isDragOver ? 'drag-over-card' : ''}`}
      style={{ overflow: 'hidden', opacity: isDragging ? 0.4 : 1 }}
      {...dropTargetProps}
    >
      <div style={{ aspectRatio: '1/1', background: '#eee', position: 'relative' }}>
        {photo.url && <img src={photo.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        {!hideMoveControls && (
          <span
            {...dragHandleProps}
            className="drag-handle"
            title="Drag to reorder"
            style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(255,255,255,0.85)', borderRadius: 4, padding: '2px 6px' }}
          >
            &#9776;
          </span>
        )}
        {isThumbnail && (
          <span style={{ position: 'absolute', bottom: 6, left: 6, background: 'var(--gold)', color: '#fff', fontSize: 10, padding: '3px 7px', letterSpacing: 0.5 }}>
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
          {!hideMoveControls && <button onClick={() => onMove(photo.id, 'left')} disabled={index === 0}>&larr;</button>}
          <button className={isThumbnail ? 'active-thumb' : ''} onClick={() => onSetThumbnail(photo.id)}>{isThumbnail ? 'Cover ✓' : 'Set cover'}</button>
          {!hideMoveControls && <button onClick={() => onMove(photo.id, 'right')} disabled={index === total - 1}>&rarr;</button>}
        </div>
        {tagChips}
        {fieldPicker}
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
        {onDelete && <button className="btn-danger" style={{ width: '100%' }} onClick={() => onDelete(photo.id)}>Delete photo</button>}
      </div>
    </div>
  );
}
