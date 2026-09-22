'use client';

import { useEffect, useRef, useState } from 'react';
import type { HTMLAttributes } from 'react';
import { useRouter } from 'next/navigation';
import PhotoCropEditor from '@/components/admin/PhotoCropEditor';
import type { SavedCrop } from '@/lib/photo-crop';
import MultiSelect from '@/components/MultiSelect';
import IconSelect from '@/components/IconSelect';
import { categoryIconUrl } from '@/lib/category-icons';
import ShapeSizeSelect from '@/components/ShapeSizeSelect';
import { useDragReorder, moveItem } from '@/hooks/useDragReorder';
import { groupMemberIds } from '@/lib/photo-groups';

type Ref = { id: number; name: string };
type ColorRef = Ref & { hexValue?: string | null; refPhotoUrl?: string | null };
type ShapeRef = Ref & { iconKey?: string | null };
type Tag = Ref & { is_global: boolean };
type Size = { id: number; shape_id: number; size_mm: string; weight_ct: number | null };
type Photo = {
  coverUrl?: string | null;
  photoCrop?: SavedCrop | null;
  coverCrop?: SavedCrop | null;
  id: number;
  url: string | null;
  shapeIds: number[];
  sizeIds: number[];
  colorIds: number[];
  product_code: string | null;
  notes: string | null;
  tag_ids: number[];
  isCoverOnly: boolean;
  watermarkId: number | null;
  /** Set when this photo is another angle of a grouped stone. The lead photo
      is the group's cover and carries its shape/size/colour/spec tags. */
  parentPhotoId: number | null;
};

// Drawn rather than typed: the download arrow this used to use (U+2B73) is
// absent from Jost, so it rendered as an empty tofu box. Same inline-SVG
// approach as DeleteRowButton's trash icon.
const DownloadIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M12 3v12" />
    <path d="M7 11l5 5 5-5" />
    <path d="M4 20h16" />
  </svg>
);

type BadgeType = 'shapes' | 'colors' | 'sizes';
const BADGE_OPTIONS: { value: BadgeType; label: string }[] = [
  { value: 'shapes', label: 'Shapes' },
  { value: 'colors', label: 'Colors' },
  { value: 'sizes', label: 'Sizes' }
];

export default function CategoryAdminClient({
  categoryId,
  section = 'overview',
  allShapes,
  allTags,
  allSizes,
  linkedShapes,
  linkedColors,
  linkedSizes,
  linkedTags,
  linkedShapeIds,
  linkedColorIds,
  linkedTagIds,
  linkedSizeIds,
  thumbnailPhotoId,
  photos,
  watermarks,
  otherCategories,
  badgeTypes,
  shapeReference
}: {
  categoryId: number;
  section?: string;
  /** Full catalogue-wide lists -- only populated by the server for the tabs
      that actually need to offer items beyond what's already linked
      ("Shapes & sizes" for allShapes/allSizes). Empty on every other tab. */
  allShapes: ShapeRef[];
  allTags: Tag[];
  allSizes: Size[];
  /** Already resolved to just this category's linked rows -- cheap on every
      tab, unlike the full catalogue-wide lists above. */
  linkedShapes: ShapeRef[];
  linkedColors: ColorRef[];
  linkedSizes: Size[];
  linkedTags: Tag[];
  linkedShapeIds: number[];
  linkedColorIds: number[];
  linkedTagIds: number[];
  linkedSizeIds: number[];
  thumbnailPhotoId: number | null;
  photos: Photo[];
  /** Watermark presets available to apply to a photo -- empty on every tab
      but Photos. */
  watermarks: { id: number; name: string }[];
  /** Every other category's id/name, for the Photos tab's "Add to category"
      bulk action -- empty on every other tab. */
  otherCategories: { id: number; name: string; slug: string | null }[];
  badgeTypes: BadgeType[];
  /** The Shapes & sizes tab's card grid of linked shapes. Rendered on the
      server (it reads per-category reference photos) and passed in as a slot
      so it can sit below the picker, matching the Colors tab's order. */
  shapeReference?: React.ReactNode;
}) {
  const router = useRouter();
  const [expandedSummary, setExpandedSummary] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState(false);
  // Upload several angles of one stone straight into a group, instead of
  // uploading them loose and having to find and group them afterwards.
  const [uploadAsGroup, setUploadAsGroup] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [driveText, setDriveText] = useState('');
  const [driveDialogOpen, setDriveDialogOpen] = useState(false);
  const driveDialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (driveDialogOpen && !driveDialogRef.current?.open) driveDialogRef.current?.showModal(); }, [driveDialogOpen]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [localBadgeTypes, setLocalBadgeTypes] = useState<BadgeType[]>(badgeTypes);
  const [toast, setToast] = useState('');
  const [photoSaveError, setPhotoSaveError] = useState('');

  const [localPhotos, setLocalPhotos] = useState(photos);
  useEffect(() => setLocalPhotos(photos), [photos]);

  // Bulk photo actions (Photos tab only): a "Select" mode toggle keeps the
  // gallery's normal per-photo controls uncluttered until the admin actually
  // wants to act on several photos at once.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<number[]>([]);
  const [bulkWatermarkId, setBulkWatermarkId] = useState<number | ''>('');
  const [moveTargetId, setMoveTargetId] = useState<number | ''>('');
  const [bulkBusy, setBulkBusy] = useState(false);

  // UI/UX audit ("visible saved-state feedback"): upload/import/delete/set-cover
  // previously refreshed with no acknowledgement -- a failed request and a
  // successful one looked identical. Per-field edits (shape/color/tag pickers)
  // aren't covered here -- their own control already shows the new value
  // immediately, so a toast on top would just be noise.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // The gallery grid (and the photo count/Explore Photos) never includes a
  // dedicated cover-only upload -- it's a distinct image, not a catalogue
  // stone. The cover photo itself is whichever photo is the thumbnail,
  // cover-only or not.
  const galleryPhotos = localPhotos.filter((p) => !p.isCoverOnly);
  const untaggedCount = galleryPhotos.filter((p) => !p.shapeIds.length && !p.colorIds.length).length;
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
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTagName, is_global: global, category_id: categoryId })
    });
    if (!res.ok) { setToast('Failed to add specification -- try again.'); return; }
    setNewTagName('');
    setToast('Specification added.');
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
    let failures = 0;
    // The first file of a group is its cover; every later one attaches to it,
    // which is why these go up one at a time rather than all at once.
    let parentId: number | null = null;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category_id', String(categoryId));
      if (uploadAsGroup && parentId !== null) fd.append('parent_photo_id', String(parentId));
      const res = await fetch('/api/photos/upload', { method: 'POST', body: fd });
      if (!res.ok) { failures++; continue; }
      if (uploadAsGroup && parentId === null) {
        const photo = await res.json().catch(() => null);
        if (photo?.id) parentId = photo.id;
      }
    }
    setUploading(false);
    setUploadAsGroup(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    const count = files.length;
    setToast(
      failures === 0
        ? `${count} photo${count === 1 ? '' : 's'} uploaded.`
        : `${count - failures} of ${count} uploaded -- ${failures} failed.`
    );
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
    const res = await fetch('/api/photos/upload', { method: 'POST', body: fd });
    setUploadingCover(false);
    if (coverInputRef.current) coverInputRef.current.value = '';
    if (!res.ok) { setToast('Failed to upload cover photo -- try again.'); return; }
    setToast('Cover photo uploaded.');
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
    const res = await fetch('/api/photos/import-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId, drive_ids: ids })
    });
    setImporting(false);
    if (!res.ok) { setToast('Failed to import from Drive -- try again.'); return; }
    setDriveText('');
    driveDialogRef.current?.close();
    setToast(`${ids.length} photo${ids.length === 1 ? '' : 's'} imported.`);
    router.refresh();
  }

  async function updatePhoto(
    photoId: number,
    patch: { shapeIds?: number[]; sizeIds?: number[]; colorIds?: number[]; product_code?: string; notes?: string },
    tagIds?: number[]
  ) {
    try {
    const res = await fetch('/api/photos/update', {
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
    if (!res.ok) throw new Error('Save failed');
    setPhotoSaveError('');
    setToast(`Photo #${photoId} saved.`);
    router.refresh();
    } catch { setPhotoSaveError(`Photo #${photoId} could not be saved. Your selected values may not be on record. Please retry the edit.`); }
  }

  async function deletePhoto(photoId: number) {
    if (!confirm('Delete this photo? This removes it from the catalogue and this cannot be undone.')) return;
    const res = await fetch('/api/photos/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: photoId }) });
    if (!res.ok) { setToast('Failed to delete photo -- try again.'); return; }
    setToast('Photo deleted.');
    router.refresh();
  }

  async function setThumbnail(photoId: number) {
    const res = await fetch('/api/categories/set-thumbnail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId, photo_id: photoId })
    });
    if (!res.ok) { setToast('Failed to set cover photo -- try again.'); return; }
    setToast('Cover photo set.');
    router.refresh();
  }

  async function ungroupOne(photoId: number) {
    const res = await fetch('/api/photos/group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_ids: [photoId], ungroup: true })
    });
    if (!res.ok) { setToast('Failed to ungroup -- try again.'); return; }
    setToast('Ungrouped.');
    router.refresh();
  }

  async function movePhoto(photoId: number, direction: 'left' | 'right') {
    const res = await fetch('/api/photos/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId, photo_id: photoId, direction })
    });
    if (!res.ok) setToast('Failed to reorder -- try again.');
    router.refresh();
  }

  async function applyWatermark(photoId: number, watermarkId: number) {
    setToast('Adding watermark…');
    const res = await fetch(`/api/photos/${photoId}/watermark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watermark_id: watermarkId })
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setToast(d.error || 'Failed to add watermark -- try again.'); return; }
    setToast('Watermark added.');
    router.refresh();
  }

  async function removeWatermark(photoId: number) {
    const res = await fetch(`/api/photos/${photoId}/watermark`, { method: 'DELETE' });
    if (!res.ok) { setToast('Failed to remove watermark -- try again.'); return; }
    setToast('Watermark removed.');
    router.refresh();
  }

  // Watermarking is a per-photo re-encode, so this walks the selection one at
  // a time rather than firing forty requests at once, and says how far it has
  // got. Each photo that succeeds is saved; a failure part-way through leaves
  // the earlier ones watermarked and names how many did not make it.
  async function watermarkSelectedPhotos() {
    if (selectedPhotoIds.length === 0 || bulkBusy) return;
    const ids = [...selectedPhotoIds];
    setBulkBusy(true);
    let done = 0, failed = 0;
    for (const id of ids) {
      setToast(`Adding watermark… ${done + failed + 1} of ${ids.length}`);
      const res = bulkWatermarkId === ''
        ? await fetch(`/api/photos/${id}/watermark`, { method: 'DELETE' })
        : await fetch(`/api/photos/${id}/watermark`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ watermark_id: bulkWatermarkId })
          });
      if (res.ok) done++; else failed++;
    }
    setBulkBusy(false);
    const verb = bulkWatermarkId === '' ? 'cleared' : 'watermarked';
    setToast(failed ? `${done} ${verb}, ${failed} failed. Retry the ones still unchanged.` : `${done} ${verb}.`);
    router.refresh();
  }

  function toggleSelectMode() {
    setSelectMode((cur) => !cur);
    setSelectedPhotoIds([]);
    setMoveTargetId('');
  }

  function toggleSelectPhoto(photoId: number) {
    setSelectedPhotoIds((cur) => (cur.includes(photoId) ? cur.filter((id) => id !== photoId) : [...cur, photoId]));
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedPhotoIds(checked ? galleryPhotos.map((p) => p.id) : []);
  }

  // A group is one stone photographed from several angles, so a bulk action on
  // any member applies to the whole group: moving or deleting a lead while its
  // angles stayed behind would leave angles no category page could ever show.
  function withWholeGroups(ids: number[]): number[] {
    const flat = localPhotos.map((p) => ({ id: p.id, parentId: p.parentPhotoId }));
    return Array.from(new Set(ids.flatMap((id) => groupMemberIds(flat, id))));
  }

  async function groupSelectedPhotos() {
    if (selectedPhotoIds.length < 2 || bulkBusy) return;
    // The lead is whichever selected photo comes first in the gallery's own
    // order -- the same "first photo I added is the cover" rule the owner asked
    // for, and visible on screen rather than dependent on click order.
    const ordered = galleryPhotos.filter((p) => selectedPhotoIds.includes(p.id)).map((p) => p.id);
    setBulkBusy(true);
    const res = await fetch('/api/photos/group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_ids: ordered, lead_id: ordered[0] })
    });
    setBulkBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setToast(body.error || 'Failed to group these photos -- try again.');
      return;
    }
    setToast(`Grouped ${ordered.length} photos as one product.`);
    setSelectedPhotoIds([]);
    router.refresh();
  }

  async function ungroupSelectedPhotos() {
    if (selectedPhotoIds.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    const res = await fetch('/api/photos/group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_ids: selectedPhotoIds, ungroup: true })
    });
    setBulkBusy(false);
    if (!res.ok) { setToast('Failed to ungroup -- try again.'); return; }
    setToast('Ungrouped -- each photo is its own product again.');
    setSelectedPhotoIds([]);
    router.refresh();
  }

  async function moveSelectedPhotos() {
    if (!moveTargetId || selectedPhotoIds.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    const res = await fetch('/api/photos/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: withWholeGroups(selectedPhotoIds), to_category_id: moveTargetId })
    });
    setBulkBusy(false);
    if (!res.ok) { setToast('Failed to move photos -- try again.'); return; }
    const movedIds = withWholeGroups(selectedPhotoIds);
    const moved = movedIds.length;
    setLocalPhotos((cur) => cur.filter((p) => !movedIds.includes(p.id)));
    setToast(`Moved ${moved} photo${moved === 1 ? '' : 's'}.`);
    setSelectedPhotoIds([]);
    setMoveTargetId('');
    router.refresh();
  }

  async function deleteSelectedPhotos() {
    if (selectedPhotoIds.length === 0 || bulkBusy) return;
    const targetIds = withWholeGroups(selectedPhotoIds);
    const count = targetIds.length;
    const extra = count - selectedPhotoIds.length;
    if (!confirm(`Delete ${count} photo${count === 1 ? '' : 's'}${extra > 0 ? ` (including ${extra} grouped angle${extra === 1 ? '' : 's'})` : ''}? This removes them from the catalogue and cannot be undone.`)) return;
    setBulkBusy(true);
    const results = await Promise.all(
      targetIds.map((id) => fetch('/api/photos/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }))
    );
    setBulkBusy(false);
    const failed = results.filter((r) => !r.ok).length;
    const deletedIds = targetIds.filter((_, i) => results[i].ok);
    setLocalPhotos((cur) => cur.filter((p) => !deletedIds.includes(p.id)));
    setSelectedPhotoIds([]);
    if (failed > 0) setToast(`${deletedIds.length} deleted, ${failed} failed -- try again.`);
    else setToast(`Deleted ${deletedIds.length} photo${deletedIds.length === 1 ? '' : 's'}.`);
    router.refresh();
  }

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
      text: linkedSizes.map((sz) => `${sz.size_mm}mm (${linkedShapes.find((s) => s.id === sz.shape_id)?.name || '—'})`).join(', ')
    },
    { key: 'tags', label: 'Specification', count: linkedTags.length, text: linkedTags.map((t) => t.name).join(', ') }
  ];

  return (
    <div data-category-section={section} style={{ marginTop: 20 }}>
      {photoSaveError && <p role="alert">{photoSaveError}</p>}

      {/* Overview: just the at-a-glance summary -- collapsed to counts by
          default (the full name lists were overwhelming on categories with
          dozens of shapes/colors/sizes), click a count to expand it. */}
      {/* Counts used to be the whole "Overview" tab -- a signpost plus a list.
          They are more useful as a strip you can see while actually editing,
          so they render on every tab and the tab is gone. */}
      <section id="category-summary" className="cat-summary-panel" style={{ marginBottom: 20 }}>
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

      {/* Shapes & sizes -- the only tab that needs the full catalogue-wide
          lists, to offer shapes/sizes beyond what's already linked.
          Laid out to match the Colors tab: the picker that decides what this
          category carries comes first, in its own card, and the cards for what
          is already linked follow it. Before this the shape cards came first
          and the picker sat underneath them, so the two halves of the same
          workspace read in opposite orders. */}
      {section === 'shapes' && (
        <section id="category-options" style={{ marginBottom: 16 }}>
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ marginBottom: 10 }}>Available shapes &amp; sizes</h3>
            <ShapeSizeSelect
              categoryId={categoryId}
              allShapes={allShapes}
              allSizes={allSizes}
              linkedShapeIds={linkedShapeIds}
              linkedSizeIds={linkedSizeIds}
              onToggleShape={(id, active) => toggleLink('shape', id, active)}
              onToggleSize={toggleSize}
              onBulkSizes={setAllSizesForShape}
            />
          </div>
        </section>
      )}

      {/* The linked shapes themselves, rendered on the server (it reads the
          per-category reference photos) and handed down as a slot. */}
      {section === 'shapes' && shapeReference}

      {/* Specifications sits with Shapes & sizes rather than as a tab of its
          own: it is one more product attribute, and a tab holding a single
          picker was not worth the click. */}
      {section === 'shapes' && (
        <section id="category-options" style={{ marginBottom: 24 }}>
          <h3 className="section-label">Specifications</h3>
          <MultiSelect
            categoryId={categoryId}
            optionKind="tag"
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
        </section>
      )}

      {section === 'photos' && (
        <>
          {/* Cover photo -- can be a dedicated image, not necessarily one of the
              catalogue stones in the gallery below. */}
          <section id="category-cover" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 14, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Cover photo</h3>
              <input ref={coverInputRef} type="file" accept="image/*" onChange={(e) => handleCoverUpload(e.target.files)} />
              {uploadingCover && <span style={{ fontSize: 12.5 }}>Uploading…</span>}
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11.5, color: '#756e5c' }}>Homepage tags:</span>
                <div className="cat-badge-toggle">
                  {BADGE_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={localBadgeTypes.includes(o.value)}
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
                categoryId={categoryId}
                photo={coverPhoto}
                index={0}
                total={1}
                isThumbnail
                shapes={linkedShapes}
                colors={linkedColors}
                tags={linkedTags}
                sizes={linkedSizes}
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

          {/* Upload + bulk Drive import -- the Drive import used to sit open
              beside Upload photos at all times, so its blank textarea took up
              a whole column even when nobody was importing from Drive. It's
              a popup now, behind a button, like the other admin create forms. */}
          <div id="category-upload" className="admin-upload-row">
            <section>
              <h3 style={{ fontSize: 14, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Upload photos</h3>
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => handleUpload(e.target.files)} />
              {uploading && <span style={{ marginLeft: 10, fontSize: 12.5 }}>Uploading…</span>}
              <label className="photo-upload-group" style={{ marginTop: 10 }}>
                <input type="checkbox" checked={uploadAsGroup} onChange={(e) => setUploadAsGroup(e.target.checked)} disabled={uploading} />
                <span>
                  Group these as one product
                  <em>Several angles of the same stone: the first file becomes the cover, and customers swipe through the rest.</em>
                </span>
              </label>
            </section>

            <section>
              <h3 style={{ fontSize: 14, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Or import from Google Drive</h3>
              <button type="button" className="btn-ghost" onClick={() => setDriveDialogOpen(true)}>Open from Google Drive</button>
            </section>
          </div>

          {driveDialogOpen && (
            <dialog
              ref={driveDialogRef}
              className="admin-create-dialog"
              aria-label="Import photos from Google Drive"
              onCancel={(e) => { e.preventDefault(); driveDialogRef.current?.close(); }}
              onClose={() => { setDriveDialogOpen(false); setDriveText(''); }}
              onClick={(e) => { if (e.target === e.currentTarget) driveDialogRef.current?.close(); }}
            >
              <div className="admin-create-dialog-head">
                <strong>Import from Google Drive</strong>
                <button type="button" autoFocus onClick={() => driveDialogRef.current?.close()} aria-label="Close">✕</button>
              </div>
              <p style={{ fontSize: 12.5, color: '#756e5c', marginBottom: 8 }}>Paste Drive share links or file IDs, one per line -- no re-upload needed.</p>
              <textarea aria-label="Google Drive photo links or IDs" rows={5} style={{ width: '100%' }} value={driveText} onChange={(e) => setDriveText(e.target.value)} />
              <div style={{ marginTop: 10 }}>
                <button className="btn" onClick={importDrive} disabled={importing || !driveText.trim()}>{importing ? 'Importing…' : 'Import'}</button>
              </div>
            </dialog>
          )}

          {/* Photo grid with per-photo tagging */}
          <section id="category-gallery">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{galleryPhotos.length} photos</h3>
              {galleryPhotos.length > 0 && (
                <a className="btn-ghost" style={{ fontSize: 12, marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }} href={`/api/admin/categories/${categoryId}/photos-zip`}>
                  <DownloadIcon size={14} /> Download all photos
                </a>
              )}
              <button type="button" className={selectMode ? 'btn' : 'btn-ghost'} style={{ fontSize: 12, marginLeft: galleryPhotos.length > 0 ? 0 : 'auto' }} onClick={toggleSelectMode}>
                {selectMode ? 'Done selecting' : 'Select'}
              </button>
            </div>
            {selectMode ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14, padding: '10px 12px', background: '#f4f1e8', borderRadius: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                  <input
                    type="checkbox"
                    checked={galleryPhotos.length > 0 && selectedPhotoIds.length === galleryPhotos.length}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                  />
                  Select all
                </label>
                <span style={{ fontSize: 12.5, color: '#756e5c' }}>{selectedPhotoIds.length} selected</span>
                <div style={{ maxWidth: 220, flex: '1 1 180px', opacity: selectedPhotoIds.length === 0 ? 0.5 : 1, pointerEvents: selectedPhotoIds.length === 0 ? 'none' : undefined }}>
                  <IconSelect
                    options={otherCategories.map((c) => ({ id: c.id, name: c.name, refPhotoUrl: categoryIconUrl(c.slug) }))}
                    value={moveTargetId === '' ? 'all' : moveTargetId}
                    onChange={(v) => setMoveTargetId(v === 'all' ? '' : Number(v))}
                    allLabel="Add to category…"
                    leading="photo"
                    searchable
                  />
                </div>
                <button className="btn" disabled={!moveTargetId || selectedPhotoIds.length === 0 || bulkBusy} onClick={moveSelectedPhotos}>
                  {bulkBusy ? 'Working…' : 'Add to category'}
                </button>
                {watermarks.length > 0 && (
                  <>
                    <select
                      value={bulkWatermarkId}
                      onChange={(e) => setBulkWatermarkId(e.target.value === '' ? '' : Number(e.target.value))}
                      aria-label="Watermark to apply"
                      style={{ fontSize: 12.5 }}
                    >
                      <option value="">Remove watermark</option>
                      {watermarks.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    <button className="btn" disabled={selectedPhotoIds.length === 0 || bulkBusy} onClick={watermarkSelectedPhotos}>
                      {bulkBusy ? 'Working…' : bulkWatermarkId === '' ? 'Clear watermark' : 'Add watermark'}
                    </button>
                  </>
                )}
                <button
                  className="btn"
                  disabled={selectedPhotoIds.length < 2 || bulkBusy}
                  onClick={groupSelectedPhotos}
                  title="Show these as one product a customer swipes through. The first one in this gallery becomes the cover."
                >
                  {bulkBusy ? 'Working…' : 'Group as one product'}
                </button>
                <button className="btn-ghost" disabled={selectedPhotoIds.length === 0 || bulkBusy} onClick={ungroupSelectedPhotos}>
                  {bulkBusy ? 'Working…' : 'Ungroup'}
                </button>
                <button className="btn-danger" disabled={selectedPhotoIds.length === 0 || bulkBusy} onClick={deleteSelectedPhotos}>
                  {bulkBusy ? 'Working…' : 'Delete selected'}
                </button>
              </div>
            ) : (
              <>
                {/* The buyer-facing reference strip narrows itself to photos
                    matching the shape and colour being ordered, but only for
                    photos that carry those links -- with none tagged it just
                    shows the whole gallery to everyone. Nothing surfaced that,
                    so the feature looked broken rather than unconfigured. */}
                {/* Grouping already-uploaded photos lives behind Select, which
                    is not somewhere anyone would think to look for it. */}
                {galleryPhotos.length > 1 && (
                  <p style={{ fontSize: 12, color: '#756e5c', marginBottom: 12 }}>
                    Several photos of the same stone? Tap <strong>Select</strong>, tick them, then <strong>Group as one product</strong> — customers see one card and swipe through the angles.
                  </p>
                )}
                {untaggedCount > 0 && (
                  <p style={{ fontSize: 12, color: 'var(--gold)', marginBottom: 12 }}>
                    {untaggedCount} of {galleryPhotos.length} photos have no shape or colour set. Customers only see reference photos matched to what they are ordering once these are tagged.
                  </p>
                )}
              </>
            )}
            <div className="admin-photo-grid">
              {galleryPhotos.map((p, i) => (
                <PhotoRow
                  categoryId={categoryId}
                  key={p.id}
                  photo={p}
                  index={i}
                  total={galleryPhotos.length}
                  isThumbnail={thumbnailPhotoId === p.id}
                  shapes={linkedShapes}
                  colors={linkedColors}
                  tags={linkedTags}
                  sizes={linkedSizes}
                  onUpdate={updatePhoto}
                  onDelete={deletePhoto}
                  onSetThumbnail={setThumbnail}
                  onMove={movePhoto}
                  onCreateTag={createPhotoTag}
                  watermarks={watermarks}
                  onApplyWatermark={applyWatermark}
                  onRemoveWatermark={removeWatermark}
                  dragHandleProps={dragHandleProps(i)}
                  dropTargetProps={dropTargetProps(i)}
                  isDragging={dragIndex === i}
                  isDragOver={overIndex === i}
                  selectMode={selectMode}
                  selected={selectedPhotoIds.includes(p.id)}
                  onToggleSelect={() => toggleSelectPhoto(p.id)}
                  angleCount={galleryPhotos.filter((other) => other.parentPhotoId === p.id).length}
                  leadOf={p.parentPhotoId}
                  onUngroup={ungroupOne}
                />
              ))}
            </div>
          </section>
        </>
      )}
      {toast && <p className="po-toast" role="status" aria-live="polite">{toast}</p>}
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
  categoryId,
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
  fieldOptions,
  selectMode,
  selected,
  onToggleSelect,
  watermarks,
  onApplyWatermark,
  onRemoveWatermark,
  angleCount = 0,
  leadOf = null,
  onUngroup
}: {
  categoryId: number;
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
  /** Bulk-select mode for the "Add to category" / "Delete selected" toolbar --
      not offered on the dedicated Cover Photo section (hideMoveControls). */
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  /** Not offered on the dedicated Cover Photo section -- a watermark only
      ever applies to the "photo" variant, never the separate cover crop. */
  watermarks?: { id: number; name: string }[];
  onApplyWatermark?: (id: number, watermarkId: number) => void;
  onRemoveWatermark?: (id: number) => void;
  /** How many other photos hang off this one as extra angles of the same stone. */
  angleCount?: number;
  /** Set when this photo is itself an angle -- the id of its group's cover. */
  leadOf?: number | null;
  onUngroup?: (id: number) => void;
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
  const [showAddTag, setShowAddTag] = useState(false);

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
    setShowAddTag(false);
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
            <button type="button" aria-label={`Remove shape ${name}`} className="tag-chip-mini-x" onClick={() => updateShapes(shapeIds.filter((v) => v !== id))}>&times;</button>
          </span>
        ) : null;
      })}
      {sizeIds.map((id) => {
        const size = sizes.find((s) => s.id === id);
        return size ? (
          <span key={`sz-${id}`} className="tag-chip-mini">
            {size.size_mm}mm
            <button type="button" aria-label={`Remove size ${size.size_mm}mm`} className="tag-chip-mini-x" onClick={() => updateSizes(sizeIds.filter((v) => v !== id))}>&times;</button>
          </span>
        ) : null;
      })}
      {colorIds.map((id) => {
        const name = colors.find((c) => c.id === id)?.name;
        return name ? (
          <span key={`co-${id}`} className="tag-chip-mini">
            {name}
            <button type="button" aria-label={`Remove color ${name}`} className="tag-chip-mini-x" onClick={() => updateColors(colorIds.filter((v) => v !== id))}>&times;</button>
          </span>
        ) : null;
      })}
      {tagIds.map((id) => {
        const name = tags.find((t) => t.id === id)?.name;
        return name ? (
          <span key={`tg-${id}`} className="tag-chip-mini">
            {name}
            <button type="button" aria-label={`Remove specification ${name}`} className="tag-chip-mini-x" onClick={() => toggleTag(id)}>&times;</button>
          </span>
        ) : null;
      })}
    </div>
  );

  // Field selector + its matching value picker side by side, not stacked.
  const fieldPicker = (
    <div className="photo-field-picker" style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'flex-start' }}>
      <select value={field} onChange={(e) => setField(e.target.value as FieldType)} style={{ fontSize: 12, flex: '0 0 auto', width: 'auto', minWidth: 90 }}>
        {visibleFieldOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <div style={{ flex: 1, minWidth: 0 }}>
        {field === 'shape' && (
          <IconSelect
            categoryId={categoryId}
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
            categoryId={categoryId}
            multiple
            optionKind="size"
            options={availableSizes.map((s) => ({ id: s.id, name: `${s.size_mm} mm` }))}
            values={sizeIds}
            onChange={updateSizes}
            placeholder={shapeIds.length === 0 ? 'Pick a shape first' : 'No sizes'}
          />
        )}
        {field === 'color' && (
          <IconSelect
            categoryId={categoryId}
            multiple
            options={colors.map((c) => ({ id: c.id, name: c.name, hex: c.hexValue, refPhotoUrl: c.refPhotoUrl }))}
            values={colorIds}
            onChange={updateColors}
            placeholder="No colors"
            leading="swatch"
          />
        )}
        {field === 'tags' && (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
              {tags.length === 0 && !showAddTag && <span style={{ fontSize: 11, color: '#756e5c' }}>No specifications on this category yet.</span>}
              {tags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={tagIds.includes(t.id)}
                  className={`tag-chip ${tagIds.includes(t.id) ? 'active' : ''}`}
                  style={{ cursor: 'pointer', fontSize: 11 }}
                  onClick={() => toggleTag(t.id)}
                >
                  {t.name}
                </button>
              ))}
              <button
                type="button"
                className="btn-ghost photo-add-spec-btn"
                onClick={() => setShowAddTag((v) => !v)}
                title="Add a custom specification"
                aria-label="Add a custom specification"
                aria-expanded={showAddTag}
              >
                +
              </button>
            </div>
            {showAddTag && (
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <input
                  type="text"
                  autoFocus
                  placeholder="New specification, e.g. Brilliant Cut"
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addOtherTag()}
                  style={{ fontSize: 12 }}
                />
                <button className="btn-ghost" style={{ whiteSpace: 'nowrap' }} onClick={addOtherTag} disabled={creatingTag || !otherText.trim()}>
                  {creatingTag ? 'Adding…' : 'Add'}
                </button>
              </div>
            )}
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

  const cropControls = <PhotoCropEditor photoId={photo.id} photoCrop={photo.photoCrop} coverCrop={photo.coverCrop} coverOnly={compact || photo.isCoverOnly} isCover={isThumbnail} />;

  if (compact) {
    return (
      <div className="card" style={{ display: 'flex', gap: 12, padding: 10 }}>
        <div style={{ width: 110, height: 110, flexShrink: 0, position: 'relative', background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
          {photo.url && <img src={photo.coverUrl || photo.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {cropControls}
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
        {!hideMoveControls && selectMode ? (
          <label
            style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(255,255,255,0.9)', borderRadius: 4, padding: '4px 6px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <input type="checkbox" checked={!!selected} onChange={onToggleSelect} aria-label={`Select photo #${photo.id}`} style={{ margin: 0 }} />
          </label>
        ) : !hideMoveControls && (
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
        {/* Grouping is invisible in a flat grid otherwise: a lead looks like
            any other photo, and an angle looks like a duplicate someone
            uploaded twice. */}
        {(angleCount > 0 || leadOf) && (
          <span
            style={{ position: 'absolute', bottom: 6, left: isThumbnail ? 70 : 6, background: 'rgba(156,122,37,0.92)', color: '#fff', fontSize: 10, padding: '3px 7px', letterSpacing: 0.3 }}
            title={leadOf ? `Extra angle shown inside photo #${leadOf}'s product card` : 'Cover of a product group customers swipe through'}
          >
            {leadOf ? `ANGLE OF #${leadOf}` : `COVER +${angleCount}`}
          </span>
        )}
        {/* 40px square rather than the old ~22x20 -- it sits over a photo on a
            touch screen, where a tap that misses opens the crop editor. */}
        <a
          href={`/api/admin/photos/${photo.id}/download`}
          title="Download full-quality photo"
          aria-label="Download full-quality photo"
          style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(255,255,255,0.88)', borderRadius: 6, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: 'var(--ink)' }}
        >
          <DownloadIcon size={18} />
        </a>
      </div>
      <div style={{ padding: 10 }}>
        <div className="photo-controls">
          {!hideMoveControls && <button onClick={() => onMove(photo.id, 'left')} disabled={index === 0}>&larr;</button>}
          <button className={isThumbnail ? 'active-thumb' : ''} onClick={() => onSetThumbnail(photo.id)}>{isThumbnail ? 'Cover ✓' : 'Set cover'}</button>
          {!hideMoveControls && <button onClick={() => onMove(photo.id, 'right')} disabled={index === total - 1}>&rarr;</button>}
        </div>
        {cropControls}
        {watermarks && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
            <select
              value={photo.watermarkId || ''}
              onChange={(e) => {
                const value = e.target.value;
                if (!value) onRemoveWatermark?.(photo.id);
                else onApplyWatermark?.(photo.id, Number(value));
              }}
              style={{ fontSize: 11.5 }}
              aria-label="Watermark"
            >
              <option value="">No watermark</option>
              {watermarks.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        )}
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
        {(angleCount > 0 || leadOf) && onUngroup && (
          <button className="btn-ghost" style={{ width: '100%', fontSize: 11.5, marginBottom: 6 }} onClick={() => onUngroup(photo.id)}>
            {leadOf ? 'Detach from group' : `Ungroup (${angleCount} angle${angleCount === 1 ? '' : 's'})`}
          </button>
        )}
        {onDelete && <button className="btn-danger" style={{ width: '100%' }} onClick={() => onDelete(photo.id)}>Delete photo</button>}
      </div>
    </div>
  );
}
