'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useHotSelling } from '@/components/HotSelling';
import { isHot } from '@/lib/hot-selling';
import {specialCategory} from '@/lib/order-specs';
import IconSelect from '@/components/IconSelect';
import { groupSizes } from '@/lib/size-options';

type Ref = { id: number; name: string; iconKey?: string | null; hex?: string | null; refPhotoUrl?: string | null };
type Size = { id: number; shape_id: number; size_mm: string };
type Photo = {
  id: number;
  url: string | null;
  shapeIds: number[];
  sizeIds: number[];
  colorIds: number[];
  tag_ids: number[];
};

const CART_KEY = 'yoyo_po_cart_v2';
// Default quantity for a one-click add from a photo -- same field the
// customer would otherwise type into the "Raise Purchase Order" tab's Qty
// box, adjustable there afterward. This just needs a sane starting point.
const DEFAULT_QTY = 100;

function loadCart(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCart(cart: any[]) {
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    // storage full/disabled -- nothing we can do here
  }
}



export default function CategoryClient({
  categoryId,
  categoryName,
  shapes,
  colors,
  tags,
  sizes,
  photos
}: {
  categoryId: number;
  categoryName: string;
  shapes: Ref[];
  colors: Ref[];
  tags: Ref[];
  sizes: Size[];
  photos: Photo[];
}) {
  const [addFeedback, setAddFeedback] = useState<Record<number, string>>({});

  const { flags } = useHotSelling();
  // A photo can be tagged with more than one shape/color/size (e.g. one
  // photo standing in for a size range) -- adding it fans out into one cart
  // line per combination, same as the multi-select "Add line" builders
  // elsewhere. Written into the same localStorage cart POSelector reads, so
  // it shows up under "Your Requirement" the moment the customer switches
  // to the "Raise Purchase Order" tab.

  const [shapeFilter, setShapeFilter] = useState<number | 'all'>('all');
  const [colorFilter, setColorFilter] = useState<number | 'all'>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<number | 'all'>('all');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lightboxCloseRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  function openLightbox(i: number, e: { currentTarget: HTMLElement }) {
    lastTriggerRef.current = e.currentTarget;
    setLightbox(i);
  }
  function closeLightbox() {
    setLightbox(null);
    lastTriggerRef.current?.focus();
  }

  // UI/UX audit C-03: the lightbox had no dialog semantics, no focus
  // management, and its close control was announced only as "×". Move
  // focus into the dialog on open (restored to the triggering photo tile
  // on close), and support Escape/Left/Right without a mouse.
  useEffect(() => {
    if (lightbox === null) return;
    dialogRef.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    lightboxCloseRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Tab') {
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
      if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setLightbox((cur) => (cur === null ? cur : Math.min(cur + 1, filtered.length - 1))); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setLightbox((cur) => (cur === null ? cur : Math.max(cur - 1, 0))); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox !== null]);

  const availableSizes = useMemo(
    () => groupSizes(shapeFilter === 'all' ? sizes : sizes.filter((s) => s.shape_id === shapeFilter)),
    [sizes, shapeFilter]
  );

  const filtered = useMemo(() => {
    return photos.filter((p) => {
      if (shapeFilter !== 'all' && !p.shapeIds.includes(shapeFilter)) return false;
      if (colorFilter !== 'all' && !p.colorIds.includes(colorFilter)) return false;
      if (sizeFilter !== 'all' && !availableSizes.find(size => size.key === sizeFilter)?.ids.some(id => p.sizeIds.includes(id))) return false;
      if (tagFilter !== 'all' && !p.tag_ids.includes(tagFilter)) return false;
      return true;
    });
  }, [photos, shapeFilter, colorFilter, sizeFilter, tagFilter, availableSizes]);

  // Precompute id -> name lookups once instead of a linear .find() per id per
  // photo, and cache each photo's details string once instead of recomputing
  // it on every render -- this page's grid calls detailsFor per photo, and the
  // lightbox called it three separate times per render on top of that.
  const shapeNameById = useMemo(() => new Map(shapes.map((s) => [s.id, s.name])), [shapes]);
  const sizeMmById = useMemo(() => new Map(sizes.map((s) => [s.id, s.size_mm])), [sizes]);
  const colorNameById = useMemo(() => new Map(colors.map((c) => [c.id, c.name])), [colors]);
  const tagNameById = useMemo(() => new Map(tags.map((t) => [t.id, t.name])), [tags]);
  const detailsByPhotoId = useMemo(() => {
    const map = new Map<number, string>();
    for (const photo of photos) {
      const shapeNames = photo.shapeIds.map((id) => shapeNameById.get(id)).filter(Boolean);
      const sizeNames = photo.sizeIds.map((id) => sizeMmById.get(id)).filter(Boolean).map((mm) => `${mm}mm`);
      const colorNames = photo.colorIds.map((id) => colorNameById.get(id)).filter(Boolean);
      const specNames = photo.tag_ids.map((id) => tagNameById.get(id)).filter(Boolean);
      map.set(photo.id, [...shapeNames, ...sizeNames, ...colorNames, ...specNames].join(', '));
    }
    return map;
  }, [photos, shapeNameById, sizeMmById, colorNameById, tagNameById]);
  function detailsFor(photo: Photo) {
    return detailsByPhotoId.get(photo.id) || '';
  }

  return (
    <>
      {(shapes.length > 0 || colors.length > 0 || tags.length > 0) && (
        <div className="filter-bar">
          {shapes.length > 0 && (
            <IconSelect
              categoryId={categoryId}
              options={shapes}
              value={shapeFilter}
              onChange={(v) => { setShapeFilter(v); setSizeFilter('all'); }}
              allLabel="All shapes"
              leading="icon"
            />
          )}
          {availableSizes.length > 0 && (
            <select aria-label="Filter by size" value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)}>
              <option value="all">All sizes</option>
              {[...availableSizes].sort((a,b) => Number(isHot(flags,categoryId,'size',b.ids))-Number(isHot(flags,categoryId,'size',a.ids))).map((s) => <option key={s.key} value={s.key}>{isHot(flags,categoryId,'size',s.ids) ? '🔥 ' : ''}{s.label} mm</option>)}
            </select>
          )}
          {colors.length > 0 && (
            <IconSelect categoryId={categoryId} options={colors} value={colorFilter} onChange={setColorFilter} allLabel="All colors" leading="swatch" />
          )}
          {tags.length > 0 && (
            <select aria-label="Filter by specification" value={tagFilter} onChange={(e) => setTagFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
              <option value="all">All specifications</option>
              {[...tags].sort((a,b) => Number(isHot(flags,categoryId,'tag',[b.id]))-Number(isHot(flags,categoryId,'tag',[a.id]))).map((t) => <option key={t.id} value={t.id}>{isHot(flags,categoryId,'tag',[t.id]) ? '🔥 ' : ''}{t.name}</option>)}
            </select>
          )}
          <span style={{ fontSize: 12, color: '#756e5c' }}>{filtered.length} of {photos.length} photos</span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#756e5c', border: '1px dashed var(--line)' }}>
          No photos match these filters yet.
        </div>
      ) : (
        <div className="grid-photos">
          {filtered.map((p, i) => {
            const feedback = addFeedback[p.id];
            const details = detailsFor(p);
            return (
              <div
                key={p.id}
                className="photo-card"
                role="button"
                tabIndex={0}
                aria-label={details ? `View photo: ${details}` : 'View photo'}
                onClick={(e) => openLightbox(i, e)}
                onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(i, e); } }}
                style={{ cursor: 'zoom-in' }}
              >
                {p.url && <img src={p.url} alt={details || 'Product photo'} loading="lazy" />}
                {/* The add-to-requirement shortcut is gone: Explore Photos is for
                    looking, and a one-tap add from a photo produced lines whose
                    shape/size/colour the buyer never actually chose. */}
                {/* Specs stay hidden until hover, keeping the grid clean --
                    same info detailsFor() already builds. */}
                {details && <div className="photo-card-details">{details}</div>}
                {feedback && <div className="photo-add-feedback">{feedback}</div>}
              </div>
            );
          })}
        </div>
      )}

      {lightbox !== null && filtered[lightbox] && (
        <dialog
          ref={dialogRef}
          className="photo-dialog"
          onCancel={(e) => { e.preventDefault(); closeLightbox(); }}
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,28,0.94)', zIndex: 100, width: '100vw', height: '100dvh', maxWidth: '100vw', maxHeight: '100dvh', margin: 0, border: 0, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeLightbox(); }}
        >
          <img
            src={filtered[lightbox].url || ''}
            alt={detailsFor(filtered[lightbox]) || 'Product photo'}
            style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain' }}
            onClick={(e) => e.stopPropagation()}
          />
          {detailsFor(filtered[lightbox]) && (
            <p style={{ color: '#fff', fontSize: 13, marginTop: 14, textAlign: 'center', maxWidth: '80vw' }}>
              {detailsFor(filtered[lightbox])}
            </p>
          )}
          {/* Always present, disabled at the ends, with a position counter --
              they used to appear and disappear at the first and last photo, so
              there was no steady way to page back and forth. */}
          <button
            type="button"
            className="photo-dialog-nav photo-dialog-prev"
            aria-label="Previous photo"
            disabled={lightbox === 0}
            onClick={(e) => { e.stopPropagation(); setLightbox(Math.max(0, lightbox - 1)); }}
          >
            &#8249;
          </button>
          <button
            type="button"
            className="photo-dialog-nav photo-dialog-next"
            aria-label="Next photo"
            disabled={lightbox >= filtered.length - 1}
            onClick={(e) => { e.stopPropagation(); setLightbox(Math.min(filtered.length - 1, lightbox + 1)); }}
          >
            &#8250;
          </button>
          <span className="photo-dialog-count" aria-live="polite">{lightbox + 1} / {filtered.length}</span>
          <button
            ref={lightboxCloseRef}
            type="button"
            aria-label="Close photo viewer"
            style={{ position: 'fixed', top: 20, right: 26, background: 'none', border: 'none', color: '#fff', fontSize: 30, width: 44, height: 44, cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
          >
            &times;
          </button>
        </dialog>
      )}
    </>
  );
}
