'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import IconSelect from '@/components/IconSelect';

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

const CartIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 7h2l1.5 9.5a2 2 0 0 0 2 1.5h7a2 2 0 0 0 2-1.66L20 9H7" />
    <circle cx="10" cy="20" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="17" cy="20" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

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

  // A photo can be tagged with more than one shape/color/size (e.g. one
  // photo standing in for a size range) -- adding it fans out into one cart
  // line per combination, same as the multi-select "Add line" builders
  // elsewhere. Written into the same localStorage cart POSelector reads, so
  // it shows up under "Your Requirement" the moment the customer switches
  // to the "Raise Purchase Order" tab.
  function addPhotoToCart(photo: Photo) {
    if (photo.shapeIds.length === 0 || photo.colorIds.length === 0 || photo.sizeIds.length === 0) {
      setAddFeedback((cur) => ({ ...cur, [photo.id]: 'Not tagged with a shape/color/size yet.' }));
      setTimeout(() => setAddFeedback((cur) => { const next = { ...cur }; delete next[photo.id]; return next; }), 2500);
      return;
    }

    const cart = loadCart();
    let addedCount = 0;
    let firstLine = '';

    photo.shapeIds.forEach((shapeId) => {
      const shape = shapes.find((s) => s.id === shapeId);
      if (!shape) return;
      photo.colorIds.forEach((colorId) => {
        const color = colors.find((c) => c.id === colorId);
        if (!color) return;
        photo.sizeIds.forEach((sizeId) => {
          const size = sizes.find((s) => s.id === sizeId);
          if (!size) return;
          const existing = cart.find(
            (i) => i.categoryId === categoryId && i.shapeId === shapeId && i.sizeId === sizeId && i.colorId === colorId
          );
          if (existing) {
            existing.qty += DEFAULT_QTY;
          } else {
            cart.push({
              id: `${Date.now()}-${Math.random().toString(16).slice(2)}-${addedCount}`,
              categoryId,
              categoryName,
              shapeId,
              shapeName: shape.name,
              sizeId,
              sizeMm: size.size_mm,
              colorId,
              colorName: color.name,
              colorHex: color.hex || '#ccc',
              qty: DEFAULT_QTY,
              requestType: 'Place Order'
            });
          }
          addedCount++;
          if (addedCount === 1) firstLine = `${color.name} · ${size.size_mm}mm ${shape.name}`;
        });
      });
    });

    saveCart(cart);
    const message = addedCount === 1 ? `${firstLine} — ${DEFAULT_QTY} pcs added` : `${addedCount} lines added to your requirement`;
    setAddFeedback((cur) => ({ ...cur, [photo.id]: message }));
    setTimeout(() => setAddFeedback((cur) => { const next = { ...cur }; delete next[photo.id]; return next; }), 2500);
  }

  const [shapeFilter, setShapeFilter] = useState<number | 'all'>('all');
  const [colorFilter, setColorFilter] = useState<number | 'all'>('all');
  const [sizeFilter, setSizeFilter] = useState<number | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<number | 'all'>('all');
  const [lightbox, setLightbox] = useState<number | null>(null);
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
    lightboxCloseRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setLightbox((cur) => (cur === null ? cur : Math.min(cur + 1, filtered.length - 1))); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setLightbox((cur) => (cur === null ? cur : Math.max(cur - 1, 0))); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox !== null]);

  const availableSizes = useMemo(
    () => (shapeFilter === 'all' ? sizes : sizes.filter((s) => s.shape_id === shapeFilter)),
    [sizes, shapeFilter]
  );

  const filtered = useMemo(() => {
    return photos.filter((p) => {
      if (shapeFilter !== 'all' && !p.shapeIds.includes(shapeFilter)) return false;
      if (colorFilter !== 'all' && !p.colorIds.includes(colorFilter)) return false;
      if (sizeFilter !== 'all' && !p.sizeIds.includes(sizeFilter)) return false;
      if (tagFilter !== 'all' && !p.tag_ids.includes(tagFilter)) return false;
      return true;
    });
  }, [photos, shapeFilter, colorFilter, sizeFilter, tagFilter]);

  function detailsFor(photo: Photo) {
    const shapeNames = photo.shapeIds.map((id) => shapes.find((s) => s.id === id)?.name).filter(Boolean);
    const sizeNames = photo.sizeIds.map((id) => sizes.find((s) => s.id === id)?.size_mm).filter(Boolean).map((mm) => `${mm}mm`);
    const colorNames = photo.colorIds.map((id) => colors.find((c) => c.id === id)?.name).filter(Boolean);
    const specNames = photo.tag_ids.map((id) => tags.find((t) => t.id === id)?.name).filter(Boolean);
    return [...shapeNames, ...sizeNames, ...colorNames, ...specNames].join(', ');
  }

  return (
    <>
      {(shapes.length > 0 || colors.length > 0 || tags.length > 0) && (
        <div className="filter-bar">
          {shapes.length > 0 && (
            <IconSelect
              options={shapes}
              value={shapeFilter}
              onChange={(v) => { setShapeFilter(v); setSizeFilter('all'); }}
              allLabel="All shapes"
              leading="icon"
            />
          )}
          {availableSizes.length > 0 && (
            <select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
              <option value="all">All sizes</option>
              {availableSizes.map((s) => <option key={s.id} value={s.id}>{s.size_mm} mm</option>)}
            </select>
          )}
          {colors.length > 0 && (
            <IconSelect options={colors} value={colorFilter} onChange={setColorFilter} allLabel="All colors" leading="swatch" />
          )}
          {tags.length > 0 && (
            <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
              <option value="all">All specifications</option>
              {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
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
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(i, e); } }}
                style={{ cursor: 'zoom-in' }}
              >
                {p.url && <img src={p.url} alt={details || 'Product photo'} loading="lazy" />}
                <button
                  type="button"
                  className="photo-add-cart"
                  aria-label={`Add ${details || 'this photo'} to requirement`}
                  title="Add to requirement"
                  onClick={(e) => { e.stopPropagation(); addPhotoToCart(p); }}
                >
                  <CartIcon />
                </button>
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
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,28,0.94)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          onClick={closeLightbox}
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
          {lightbox > 0 && (
            <button
              type="button"
              aria-label="Previous photo"
              style={{ position: 'fixed', top: '50%', left: 12, transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', fontSize: 24, width: 44, height: 44, borderRadius: '50%', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox - 1); }}
            >
              &#8249;
            </button>
          )}
          {lightbox < filtered.length - 1 && (
            <button
              type="button"
              aria-label="Next photo"
              style={{ position: 'fixed', top: '50%', right: 12, transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', fontSize: 24, width: 44, height: 44, borderRadius: '50%', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox + 1); }}
            >
              &#8250;
            </button>
          )}
          <button
            ref={lightboxCloseRef}
            type="button"
            aria-label="Close photo viewer"
            style={{ position: 'fixed', top: 20, right: 26, background: 'none', border: 'none', color: '#fff', fontSize: 30, width: 44, height: 44, cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
          >
            &times;
          </button>
        </div>
      )}
    </>
  );
}
