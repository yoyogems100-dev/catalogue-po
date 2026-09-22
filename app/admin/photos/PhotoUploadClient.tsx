'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import IconSelect from '@/components/IconSelect';
import MultiSelect from '@/components/MultiSelect';
import { categoryIconUrl } from '@/lib/category-icons';

type Category = { id: number; name: string; slug: string | null };
type Shape = { id: number; name: string; iconKey?: string | null; refPhotoUrl?: string | null };
type Color = { id: number; name: string; hex?: string | null; refPhotoUrl?: string | null };
type Size = { id: number; shapeId: number; sizeMm: string };
type Tag = { id: number; name: string };

type Options = { shapes: Shape[]; colors: Color[]; sizes: Size[]; tags: Tag[] };

type InboxPhoto = {
  id: number;
  url: string | null;
  productCode: string | null;
  shapeIds: number[];
  sizeIds: number[];
  colorIds: number[];
  tagIds: number[];
  parentPhotoId: number | null;
};

type Uploaded = { id: number; name: string; tagError?: string };

const EMPTY: Options = { shapes: [], colors: [], sizes: [], tags: [] };

export default function PhotoUploadClient({ categories, inbox }: { categories: Category[]; inbox: InboxPhoto[] }) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState<number | 'all'>('all');
  const [options, setOptions] = useState<Options>(EMPTY);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [shapeIds, setShapeIds] = useState<number[]>([]);
  const [sizeIds, setSizeIds] = useState<number[]>([]);
  const [colorIds, setColorIds] = useState<number[]>([]);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [asGroup, setAsGroup] = useState(false);
  const [busy, setBusy] = useState('');
  const [uploaded, setUploaded] = useState<Uploaded[]>([]);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // The batch defaults can only offer what the chosen category actually
  // carries, so they're loaded per category rather than from one catalogue-wide
  // list -- picking a shape a category doesn't stock would tag a photo with
  // something its own page could never show.
  useEffect(() => {
    if (categoryId === 'all') { setOptions(EMPTY); return; }
    let live = true;
    setLoadingOptions(true);
    fetch(`/api/admin/categories/${categoryId}/options`)
      .then((r) => (r.ok ? r.json() : EMPTY))
      .then((data) => {
        if (!live) return;
        setOptions({ shapes: data.shapes || [], colors: data.colors || [], sizes: data.sizes || [], tags: data.tags || [] });
      })
      .catch(() => { if (live) setOptions(EMPTY); })
      .finally(() => { if (live) setLoadingOptions(false); });
    return () => { live = false; };
  }, [categoryId]);

  // Clear any default that the newly chosen category doesn't offer.
  useEffect(() => {
    setShapeIds((cur) => cur.filter((id) => options.shapes.some((s) => s.id === id)));
    setColorIds((cur) => cur.filter((id) => options.colors.some((c) => c.id === id)));
    setSizeIds((cur) => cur.filter((id) => options.sizes.some((s) => s.id === id)));
    setTagIds((cur) => cur.filter((id) => options.tags.some((t) => t.id === id)));
  }, [options]);

  const availableSizes = options.sizes.filter((s) => shapeIds.length === 0 || shapeIds.includes(s.shapeId));

  function toggle(setter: (fn: (cur: number[]) => number[]) => void) {
    return (id: number, selected: boolean) => setter((cur) => (selected ? cur.filter((v) => v !== id) : [...cur, id]));
  }

  const upload = useCallback(async (files: FileList | File[] | null) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;
    setError('');
    setUploaded([]);

    const results: Uploaded[] = [];
    // Uploaded one at a time so a group's cover exists before the next file
    // asks to be attached to it, and so a single failure names the file that
    // failed instead of losing the whole batch.
    let parentId: number | null = null;
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      setBusy(`Uploading ${i + 1} of ${list.length}: ${file.name}`);
      const fd = new FormData();
      fd.append('file', file);
      if (categoryId !== 'all') fd.append('category_id', String(categoryId));
      if (shapeIds.length) fd.append('shape_ids', shapeIds.join(','));
      if (sizeIds.length) fd.append('size_ids', sizeIds.join(','));
      if (colorIds.length) fd.append('color_ids', colorIds.join(','));
      if (tagIds.length) fd.append('tag_ids', tagIds.join(','));
      // The first file of a group is its cover; every later one attaches to it.
      if (asGroup && parentId !== null) fd.append('parent_photo_id', String(parentId));

      const res = await fetch('/api/photos/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setBusy('');
        setUploaded(results);
        setError(`${file.name}: ${body.error || 'upload failed'}${results.length ? ` (${results.length} uploaded before this)` : ''}`);
        router.refresh();
        return;
      }
      const photo = await res.json();
      if (asGroup && parentId === null) parentId = photo.id;
      results.push({ id: photo.id, name: file.name, tagError: photo.tagError });
    }

    setBusy('');
    setUploaded(results);
    if (fileRef.current) fileRef.current.value = '';
    router.refresh();
  }, [categoryId, shapeIds, sizeIds, colorIds, tagIds, asGroup, router]);

  const chosenCategory = categoryId === 'all' ? null : categories.find((c) => c.id === categoryId) || null;
  const taggedCount = shapeIds.length + sizeIds.length + colorIds.length + tagIds.length;

  return (
    <>
      <section className="card" style={{ padding: 16, marginBottom: 24 }}>
        <h3 className="photo-upload-head">1. Where these photos belong</h3>
        <div className="photo-upload-grid">
          <div className="ps-field">
            <label>Category</label>
            <IconSelect
              options={categories.map((c) => ({ id: c.id, name: c.name, refPhotoUrl: categoryIconUrl(c.slug) }))}
              value={categoryId}
              onChange={setCategoryId}
              allLabel="Leave unassigned for now"
              leading="photo"
              searchable
            />
          </div>
        </div>

        <h3 className="photo-upload-head" style={{ marginTop: 18 }}>2. Tags for this batch <span>optional — every field can be filled in later</span></h3>
        {categoryId === 'all' ? (
          <p style={{ fontSize: 12.5, color: '#756e5c' }}>
            Shapes, sizes, colours and specifications belong to a category, so pick one above to tag this batch as it
            uploads. Without a category the photos still upload and wait in the inbox below.
          </p>
        ) : loadingOptions ? (
          <p style={{ fontSize: 12.5, color: '#756e5c' }}>Loading {chosenCategory?.name} options…</p>
        ) : (
          <div className="photo-upload-grid">
            <div className="ps-field">
              <label>Shapes</label>
              <MultiSelect categoryId={categoryId} optionKind="shape" options={options.shapes} selectedIds={shapeIds}
                onToggle={toggle(setShapeIds)} leading="icon" placeholder="No shape" emptyHint="This category has no shapes linked yet." />
            </div>
            <div className="ps-field">
              <label>Sizes</label>
              <MultiSelect categoryId={categoryId} optionKind="size"
                options={availableSizes.map((s) => ({ id: s.id, name: `${s.sizeMm} mm` }))}
                selectedIds={sizeIds} onToggle={toggle(setSizeIds)} placeholder="No size"
                emptyHint={shapeIds.length ? 'No sizes for the chosen shapes.' : 'This category has no sizes linked yet.'} />
            </div>
            <div className="ps-field">
              <label>Colors</label>
              <MultiSelect categoryId={categoryId} optionKind="color" options={options.colors} selectedIds={colorIds}
                onToggle={toggle(setColorIds)} leading="swatch" placeholder="No color" emptyHint="This category has no colors linked yet." />
            </div>
            <div className="ps-field">
              <label>Specifications</label>
              <MultiSelect categoryId={categoryId} optionKind="tag" options={options.tags} selectedIds={tagIds}
                onToggle={toggle(setTagIds)} placeholder="No specification" emptyHint="This category has no specifications yet." />
            </div>
          </div>
        )}

        <h3 className="photo-upload-head" style={{ marginTop: 18 }}>3. The files</h3>
        <label className="photo-upload-group">
          <input type="checkbox" checked={asGroup} onChange={(e) => setAsGroup(e.target.checked)} disabled={categoryId === 'all'} />
          <span>
            Group these as one product
            <em>
              {categoryId === 'all'
                ? 'Needs a category — a group is one stone in one category.'
                : 'Several angles of the same stone: the first file becomes the cover, and customers swipe through the rest.'}
            </em>
          </span>
        </label>

        <div
          className={`photo-dropzone${dragging ? ' dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); }}
        >
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={(e) => upload(e.target.files)} disabled={!!busy} />
          <span>Drop photos here, or choose files. They upload straight away{taggedCount > 0 ? ` with ${taggedCount} tag${taggedCount === 1 ? '' : 's'} applied` : ''}.</span>
        </div>

        {busy && <p style={{ fontSize: 12.5, marginTop: 10 }}>{busy}</p>}
        {error && <p style={{ fontSize: 12.5, marginTop: 10, color: '#a3341f' }}>{error}</p>}
        {uploaded.length > 0 && !busy && (
          <div style={{ marginTop: 12, fontSize: 12.5 }}>
            <strong>{uploaded.length} photo{uploaded.length === 1 ? '' : 's'} uploaded{asGroup ? ' as one product' : ''}.</strong>
            {uploaded.some((u) => u.tagError) && (
              <p style={{ color: '#a3341f' }}>Some tags could not be saved — check those photos below or in the category.</p>
            )}
            {chosenCategory && (
              <p style={{ marginTop: 4 }}>
                <Link href={`/admin/categories/${chosenCategory.id}?tab=photos`}>Open {chosenCategory.name} → Photos</Link> to crop,
                reorder, set a cover or correct tags.
              </p>
            )}
          </div>
        )}
      </section>

      <section>
        <h3 className="photo-upload-head">
          Unassigned inbox <span>{inbox.length === 0 ? 'nothing waiting' : `${inbox.length} photo${inbox.length === 1 ? '' : 's'} with no category`}</span>
        </h3>
        {inbox.length === 0 ? (
          <p style={{ fontSize: 12.5, color: '#756e5c' }}>
            Photos uploaded without a category appear here until you give them one.
          </p>
        ) : (
          <div className="admin-photo-grid">
            {inbox.map((photo) => (
              <InboxCard key={photo.id} photo={photo} categories={categories} onDone={() => router.refresh()} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/** One waiting photo: give it a category (which is all it needs to appear in
 *  that category's Photos tab and Explore Photos), or delete it. Shape/size/
 *  colour tagging stays in the category workspace, where the full per-photo
 *  editor already lives. */
function InboxCard({ photo, categories, onDone }: { photo: InboxPhoto; categories: Category[]; onDone: () => void }) {
  const [target, setTarget] = useState<number | 'all'>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function assign() {
    if (target === 'all' || busy) return;
    setBusy(true);
    setError('');
    const res = await fetch('/api/photos/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [photo.id], to_category_id: target })
    });
    setBusy(false);
    if (!res.ok) { setError('Could not assign — try again.'); return; }
    onDone();
  }

  async function remove() {
    if (busy || !confirm('Delete this photo? This cannot be undone.')) return;
    setBusy(true);
    const res = await fetch('/api/photos/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: photo.id }) });
    setBusy(false);
    if (!res.ok) { setError('Could not delete — try again.'); return; }
    onDone();
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ aspectRatio: '1/1', background: '#eee' }}>
        {photo.url && <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      </div>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <IconSelect
          options={categories.map((c) => ({ id: c.id, name: c.name, refPhotoUrl: categoryIconUrl(c.slug) }))}
          value={target}
          onChange={setTarget}
          allLabel="Choose category…"
          leading="photo"
          searchable
        />
        <button className="btn" disabled={target === 'all' || busy} onClick={assign}>{busy ? 'Working…' : 'Assign'}</button>
        <button className="btn-ghost" style={{ fontSize: 11.5, color: '#a3341f' }} disabled={busy} onClick={remove}>Delete</button>
        {error && <span style={{ fontSize: 11.5, color: '#a3341f' }}>{error}</span>}
      </div>
    </div>
  );
}
