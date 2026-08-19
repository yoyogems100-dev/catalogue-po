'use client';

import { useMemo, useState } from 'react';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import IconSelect from '@/components/IconSelect';

type Ref = { id: number; name: string; iconKey?: string | null; hex?: string | null };
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
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 7h2l1.5 9.5a2 2 0 0 0 2 1.5h7a2 2 0 0 0 2-1.66L20 9H7" />
    <circle cx="10" cy="20" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="17" cy="20" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export default function CategoryClient({
  categoryId,
  categoryName,
  whatsappNumber,
  shapes,
  colors,
  tags,
  sizes,
  photos
}: {
  categoryId: number;
  categoryName: string;
  whatsappNumber?: string;
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
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

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
    return [...shapeNames, ...sizeNames, ...colorNames].join(', ');
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function sendMultiEnquiry() {
    if (!whatsappNumber || selectedIds.size === 0) return;
    const selectedPhotos = photos.filter((p) => selectedIds.has(p.id));
    const lines = selectedPhotos.map((p, i) => {
      const details = detailsFor(p);
      return `${i + 1}. ${details || 'Stone'} from ${categoryName}`;
    });
    const message = `Hi YOYO GEMS, I'm interested in these ${selectedPhotos.length} stones:\n${lines.join('\n')}`;
    const url = buildWhatsAppUrl(whatsappNumber, message);
    window.open(url, '_blank', 'noopener,noreferrer');
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
              <option value="all">All tags</option>
              {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <span style={{ fontSize: 12, color: '#8a8370' }}>{filtered.length} of {photos.length} photos</span>
        </div>
      )}

      {whatsappNumber && filtered.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}
            onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
          >
            {selectMode ? 'Cancel selection' : 'Select multiple to enquire'}
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#8a8370', border: '1px dashed var(--line)' }}>
          No photos match these filters yet.
        </div>
      ) : (
        <div className="grid-photos">
          {filtered.map((p, i) => {
            const isSelected = selectedIds.has(p.id);
            const feedback = addFeedback[p.id];
            return (
              <div
                key={p.id}
                className="photo-card"
                onClick={() => (selectMode ? toggleSelect(p.id) : setLightbox(i))}
                style={{ cursor: selectMode ? 'pointer' : 'zoom-in' }}
              >
                {p.url && <img src={p.url} alt="" loading="lazy" />}
                {selectMode && (
                  <div className={`photo-select-check ${isSelected ? 'checked' : ''}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="4,12 9,17 20,6" /></svg>
                  </div>
                )}
                {!selectMode && (
                  <button
                    type="button"
                    className="photo-add-cart"
                    title="Add to requirement"
                    onClick={(e) => { e.stopPropagation(); addPhotoToCart(p); }}
                  >
                    <CartIcon />
                  </button>
                )}
                {feedback && <div className="photo-add-feedback">{feedback}</div>}
              </div>
            );
          })}
        </div>
      )}

      {selectMode && selectedIds.size > 0 && <div style={{ height: 66 }} />}

      {selectMode && selectedIds.size > 0 && (
        <div className="multi-enquire-bar">
          <span>{selectedIds.size} photo{selectedIds.size !== 1 ? 's' : ''} selected</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn-ghost multi-enquire-clear" onClick={() => setSelectedIds(new Set())}>Clear</button>
            <button type="button" className="btn" onClick={sendMultiEnquiry}>Enquire about {selectedIds.size}</button>
          </div>
        </div>
      )}

      {lightbox !== null && filtered[lightbox] && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,28,0.94)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setLightbox(null)}
        >
          <img src={filtered[lightbox].url || ''} style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain' }} />
          <button
            style={{ position: 'fixed', top: 20, right: 26, background: 'none', border: 'none', color: '#fff', fontSize: 30 }}
            onClick={() => setLightbox(null)}
          >
            &times;
          </button>
        </div>
      )}
    </>
  );
}
