'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import IconSelect from '@/components/IconSelect';
import { loadCart, saveCart, mergeIntoCart, type CartItem, type RequestType } from '@/lib/cart-storage';
import { lineInrPrice, type CategoryPricing } from '@/lib/pricing-calc';
import { specialCategory } from '@/lib/order-specs';
import { priceUnitLabel } from '@/lib/price-unit';
import type { PhotoGroup } from '@/lib/photo-groups';

export type SheetPhoto = {
  id: number;
  url: string | null;
  parentId?: number | null;
  shapeIds: number[];
  sizeIds: number[];
  colorIds: number[];
  tag_ids: number[];
  productCode?: string | null;
  notes?: string | null;
};

type Ref = { id: number; name: string; iconKey?: string | null; hex?: string | null; refPhotoUrl?: string | null };
type Size = { id: number; shape_id: number; size_mm: string };

const DEFAULT_QTY = 100;

/** What the photo itself says about an attribute decides how it's offered:
 *  one tagged value is simply shown as a fact, several narrow the dropdown to
 *  those, and none at all offers everything the category carries -- which is
 *  the case the owner asked for, where a size was never recorded against the
 *  photo and the buyer picks it from a searchable list at order time. */
function offer<T extends { id: number }>(all: T[], taggedIds: number[]): { options: T[]; fixed: T | null } {
  const tagged = taggedIds.length > 0 ? all.filter((item) => taggedIds.includes(item.id)) : [];
  const options = tagged.length > 0 ? tagged : all;
  return { options, fixed: options.length === 1 ? options[0] : null };
}

export default function ProductSheet({
  categoryId,
  categoryName,
  group,
  shapes,
  colors,
  tags,
  sizes,
  pricing,
  priceUnit,
  position,
  onClose,
  onStep,
  onRaiseOrder
}: {
  categoryId: number;
  categoryName: string;
  group: PhotoGroup<SheetPhoto>;
  shapes: Ref[];
  colors: Ref[];
  tags: Ref[];
  sizes: Size[];
  pricing?: CategoryPricing;
  /** "piece" unless this category prices by something else (a strip, a pair). */
  priceUnit?: string | null;
  /** 1-based position in the filtered grid, for "3 of 18" and the arrows. */
  position?: { index: number; total: number };
  onClose: () => void;
  onStep?: (delta: number) => void;
  /** Rainbow Corundum and Hole Punched Stones need options this sheet doesn't
      collect (strip counts, drill type), so those categories send the buyer to
      the purchase composer instead of adding a line that omits them. */
  onRaiseOrder?: () => void;
}) {
  const { lead, media } = group;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [failed, setFailed] = useState<number[]>([]);
  const [qty, setQty] = useState(String(DEFAULT_QTY));
  const [requestType, setRequestType] = useState<RequestType>('Place Order');
  const [added, setAdded] = useState('');

  const shapeOffer = useMemo(() => offer(shapes, lead.shapeIds), [shapes, lead.shapeIds]);
  const colorOffer = useMemo(() => offer(colors, lead.colorIds), [colors, lead.colorIds]);

  const [shapeId, setShapeId] = useState<number | 'all'>(shapeOffer.fixed?.id ?? 'all');
  const [colorId, setColorId] = useState<number | 'all'>(colorOffer.fixed?.id ?? 'all');

  // Sizes belong to a shape, so the size list only means anything once a shape
  // is settled; within that, the photo's own tagged sizes win if it has any.
  const sizeOffer = useMemo(() => {
    const forShape = shapeId === 'all' ? [] : sizes.filter((s) => s.shape_id === shapeId);
    const tagged = forShape.filter((s) => lead.sizeIds.includes(s.id));
    const options = tagged.length > 0 ? tagged : forShape;
    return { options, fixed: options.length === 1 ? options[0] : null };
  }, [sizes, shapeId, lead.sizeIds]);

  // Settled up front, not in an effect: an effect doesn't run for the first
  // paint (or a server render), so a sheet whose shape, size and colour were
  // all already decided still opened with a disabled button reading "choose a
  // size" until React came back round.
  const [sizeId, setSizeId] = useState<number | 'all'>(() => sizeOffer.fixed?.id ?? 'all');
  useEffect(() => {
    // Re-settle the size whenever the shape changes: keep it if it still
    // belongs to the new shape, take the only option if there is only one, and
    // otherwise clear it rather than carrying another shape's size forward.
    setSizeId((current) => {
      if (current !== 'all' && sizeOffer.options.some((s) => s.id === current)) return current;
      return sizeOffer.fixed?.id ?? 'all';
    });
  }, [sizeOffer.options, sizeOffer.fixed]);

  const special = specialCategory(categoryId);
  const shape = shapeId === 'all' ? null : shapes.find((s) => s.id === shapeId) || null;
  const color = colorId === 'all' ? null : colors.find((c) => c.id === colorId) || null;
  const size = sizeId === 'all' ? null : sizes.find((s) => s.id === sizeId) || null;
  const qtyNum = Number(qty);
  const qtyValid = requestType === 'Request Quotation'
    ? qty === '' || (Number.isSafeInteger(qtyNum) && qtyNum >= 0)
    : Number.isSafeInteger(qtyNum) && qtyNum > 0;
  const canAdd = !special && !!shape && !!color && !!size && qtyValid;
  const unitPrice = pricing && shape && size && color ? lineInrPrice(pricing, shape.id, size.id, color.id) : null;

  const specChips = useMemo(() => {
    const names = [
      ...shapes.filter((s) => lead.shapeIds.includes(s.id)).map((s) => s.name),
      ...sizes.filter((s) => lead.sizeIds.includes(s.id)).map((s) => `${s.size_mm} mm`),
      ...colors.filter((c) => lead.colorIds.includes(c.id)).map((c) => c.name),
      ...tags.filter((t) => lead.tag_ids.includes(t.id)).map((t) => t.name)
    ];
    return names;
  }, [shapes, sizes, colors, tags, lead]);

  const title = lead.productCode?.trim()
    || [categoryName, shapeOffer.fixed?.name].filter(Boolean).join(' · ');

  useEffect(() => {
    dialogRef.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  // A new group reuses this component, so reset what belongs to the old one.
  useEffect(() => {
    setActive(0);
    setZoomed(false);
    setAdded('');
  }, [lead.id]);

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(''), 2600);
    return () => clearTimeout(timer);
  }, [added]);

  function step(delta: number) {
    setActive((current) => (media.length < 2 ? current : (current + delta + media.length) % media.length));
  }

  function addToRequirement() {
    if (!shape || !color || !size) return;
    const quantity = requestType === 'Request Quotation' && qty === '' ? 0 : qtyNum;
    const item: CartItem = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      categoryId,
      categoryName,
      shapeId: shape.id,
      shapeName: shape.name,
      shapeIconKey: shape.iconKey || null,
      shapeRefPhotoUrl: shape.refPhotoUrl || null,
      sizeId: size.id,
      sizeMm: size.size_mm,
      colorId: color.id,
      colorName: color.name,
      colorHex: color.hex || '#ccc',
      colorRefPhotoUrl: color.refPhotoUrl || null,
      qty: quantity,
      requestType
    };
    // Written through the shared cart helpers, so this lands as one line in the
    // same requirement the Raise Purchase Order tab and /po/cart read -- merged
    // with an identical line rather than added as a duplicate row.
    saveCart(mergeIntoCart(loadCart(), item));
    setAdded(`Added ${shape.name} · ${size.size_mm} mm · ${color.name}${quantity ? ` × ${quantity}` : ''} to your requirement.`);
  }

  const activePhoto = media[active] || lead;

  return (
    <dialog
      ref={dialogRef}
      className="product-sheet"
      aria-label={`${title} details`}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); if (zoomed || media.length > 1) step(-1); else onStep?.(-1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); if (zoomed || media.length > 1) step(1); else onStep?.(1); }
      }}
    >
      <header className="ps-head">
        <div className="ps-head-title">
          <strong>{title}</strong>
          {position && position.total > 1 && (
            <span className="ps-position" aria-live="polite">{position.index + 1} of {position.total}</span>
          )}
        </div>
        <div className="ps-head-nav">
          {onStep && position && position.total > 1 && (
            <>
              <button type="button" aria-label="Previous product" onClick={() => onStep(-1)}>‹</button>
              <button type="button" aria-label="Next product" onClick={() => onStep(1)}>›</button>
            </>
          )}
          <button ref={closeRef} type="button" aria-label="Close product details" onClick={onClose}>✕</button>
        </div>
      </header>

      <div className="ps-body">
        <div className="ps-gallery">
          <div className={`ps-stage${zoomed ? ' zoomed' : ''}`}>
            {activePhoto.url && !failed.includes(activePhoto.id) ? (
              <img
                src={activePhoto.url}
                alt={`${title}${media.length > 1 ? `, view ${active + 1} of ${media.length}` : ''}`}
                onClick={() => setZoomed((v) => !v)}
                onError={() => setFailed((ids) => [...ids, activePhoto.id])}
                style={{ cursor: zoomed ? 'zoom-out' : 'zoom-in' }}
              />
            ) : (
              <span className="po-reference-unavailable">Image unavailable</span>
            )}
            {media.length > 1 && (
              <>
                <button type="button" className="ps-stage-nav ps-stage-prev" aria-label="Previous view" onClick={() => step(-1)}>‹</button>
                <button type="button" className="ps-stage-nav ps-stage-next" aria-label="Next view" onClick={() => step(1)}>›</button>
                <span className="ps-stage-count">{active + 1} / {media.length}</span>
              </>
            )}
          </div>
          {media.length > 1 && (
            <div className="ps-thumbs" role="tablist" aria-label="Other views">
              {media.map((photo, i) => (
                <button
                  key={photo.id}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  aria-label={`View ${i + 1}`}
                  className={i === active ? 'active' : ''}
                  onClick={() => setActive(i)}
                >
                  {photo.url && <img src={photo.url} alt="" loading="lazy" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ps-info">
          {specChips.length > 0 && (
            <div className="ps-chips">
              {specChips.map((name) => <span key={name} className="ps-chip">{name}</span>)}
            </div>
          )}
          {lead.notes?.trim() && <p className="ps-notes">{lead.notes}</p>}

          {special ? (
            <div className="ps-order">
              <p className="ps-hint">
                {special === 'rainbow'
                  ? 'This category is ordered by complete strips, so the stones per strip and colour choice are set in the purchase composer.'
                  : 'This category needs a drill type (half or full), set in the purchase composer.'}
              </p>
              {onRaiseOrder && (
                <button type="button" className="btn ps-add" onClick={() => { onClose(); onRaiseOrder(); }}>
                  Raise Purchase Order
                </button>
              )}
            </div>
          ) : (
            <div className="ps-order">
              <div className="ps-field">
                <label>Shape</label>
                {shapeOffer.fixed ? (
                  <span className="ps-fixed">{shapeOffer.fixed.name}</span>
                ) : (
                  <IconSelect
                    categoryId={categoryId}
                    optionKind="shape"
                    options={shapeOffer.options}
                    value={shapeId}
                    onChange={setShapeId}
                    allLabel="Select shape"
                    leading="icon"
                    searchable
                  />
                )}
              </div>

              <div className="ps-field">
                <label>Size</label>
                {shapeId === 'all' ? (
                  <span className="ps-hint">Pick a shape first</span>
                ) : sizeOffer.options.length === 0 ? (
                  <span className="ps-hint">No sizes listed for this shape yet</span>
                ) : sizeOffer.fixed ? (
                  <span className="ps-fixed">{sizeOffer.fixed.size_mm} mm</span>
                ) : (
                  <IconSelect
                    categoryId={categoryId}
                    optionKind="size"
                    options={sizeOffer.options.map((s) => ({ id: s.id, name: `${s.size_mm} mm` }))}
                    value={sizeId}
                    onChange={setSizeId}
                    allLabel="Select size"
                    leading="none"
                    searchable
                  />
                )}
              </div>

              <div className="ps-field">
                <label>Color</label>
                {colorOffer.fixed ? (
                  <span className="ps-fixed">{colorOffer.fixed.name}</span>
                ) : (
                  <IconSelect
                    categoryId={categoryId}
                    optionKind="color"
                    options={colorOffer.options}
                    value={colorId}
                    onChange={setColorId}
                    allLabel="Select color"
                    leading="swatch"
                    searchable
                  />
                )}
              </div>

              <div className="ps-field ps-field-qty">
                <label htmlFor={`ps-qty-${lead.id}`}>Quantity</label>
                <input
                  id={`ps-qty-${lead.id}`}
                  type="number"
                  inputMode="numeric"
                  min={requestType === 'Request Quotation' ? 0 : 1}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </div>

              <div className="ps-field">
                <label>Type</label>
                <div className="ps-type-toggle">
                  {(['Place Order', 'Request Quotation'] as RequestType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={requestType === type}
                      className={requestType === type ? 'active' : ''}
                      onClick={() => setRequestType(type)}
                    >
                      {type === 'Place Order' ? 'Order' : 'Quotation'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sticks to the bottom of the sheet on a phone: the pickers push
                  the button well below the fold, and an add button you have to
                  go looking for is an add button that doesn't get used. */}
              <div className="ps-actions">
                {unitPrice !== null && (
                  <p className="ps-price">
                    ₹{unitPrice.toLocaleString('en-IN')} <span>per {priceUnitLabel(priceUnit)} — confirmed by our team</span>
                  </p>
                )}
                <button type="button" className="btn ps-add" onClick={addToRequirement} disabled={!canAdd}>
                  Add to requirement
                </button>
                {!canAdd && (
                  <p className="ps-hint">
                    {!shape ? 'Choose a shape' : !size ? 'Choose a size' : !color ? 'Choose a colour' : 'Enter a quantity'} to add this.
                  </p>
                )}
                {added && <p className="ps-added" role="status" aria-live="polite">{added}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
