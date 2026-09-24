'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import OrderReferenceCarousel from './OrderReferenceCarousel';
import type { OrderReferencePhoto } from '@/lib/order-reference-photos';
import SpecialOrderComposer from './SpecialOrderComposer';
import {specialCategory,specKey,specText,quantityFactor,type OrderSpecs} from '@/lib/order-specs';
import IconSelect from './IconSelect';
import { incompatibleShapeIds, NO_SHARED_SIZE_NOTE, NO_SHARED_SIZE_REASON } from '@/lib/shape-size-compat';
import ColorSwatch from './ColorSwatch';
import ShapeReferenceImage from './ShapeReferenceImage';
import type { CategoryPricing } from '@/lib/pricing-calc';
import { cartLinePrice } from '@/lib/pricing-calc';
import { parseQuantity } from '@/lib/quantity';
import { loadCart, saveCart, mergeIntoCart as mergeCartLines, type CartItem, type RequestType } from '@/lib/cart-storage';
import QuantityInput from './QuantityInput';
import { priceUnitLabel } from '@/lib/price-unit';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

// Glass Pearls only ever comes in round -- the shape field is redundant noise for
// customers here, so it's hidden entirely and silently locked to Round rather than
// shown as a fixed/disabled field (contrast with Moissanite's locked color, which
// customers do still need to see spelled out).
const GLASS_PEARLS_CATEGORY_ID = 16;

type ShapeRef = { id: number; name: string; iconKey?: string | null; refPhotoUrl?: string | null };
type ColorRef = { id: number; name: string; hex?: string | null; refPhotoUrl?: string | null };
type Size = { id: number; shape_id: number; size_mm: string };

// Matches a plain "1" / "1.5", or a compound "AxB"/"A*B" (x/X/* used
// interchangeably) -- range-select and sort both key off the leading
// number either way, so "4x6" sits with "4" and a 4x6-to-8x6 range picks
// up every compound size whose first dimension falls in that span.
function strictSizeNum(s: string): number {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*(?:[xX*]\s*\d+(?:\.\d+)?)?$/);
  return m ? parseFloat(m[1]) : NaN;
}

function formatInr(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

type ColorPalette = { id: number; name: string; memberIds: number[] };

export default function POSelector({
  categoryId,
  categoryName,
  whatsappNumber,
  shapes,
  colors,
  sizes,
  colorPalettes,
  photos = [],
  colorChartUrl,
  loggedIn = false,
  active = true,
  pricing,
  priceUnit
}: {
  categoryId: number;
  categoryName: string;
  whatsappNumber?: string;
  shapes: ShapeRef[];
  colors: ColorRef[];
  sizes: Size[];
  active?: boolean;
  photos?: OrderReferencePhoto[];
  colorChartUrl?: string | null;
  loggedIn?: boolean;
  colorPalettes?: ColorPalette[];
  pricing?: CategoryPricing;
  priceUnit?: string | null;
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  // The server renders this category's price list, so its own lines are priced
  // on first paint with no flash. Lines the buyer added in OTHER categories are
  // priced from lists fetched here -- without them the same basket showed a
  // total on one category page and nothing at all on the next.
  const [otherPricing, setOtherPricing] = useState<Record<number, CategoryPricing>>({});
  // Multi-select: an order line can now cover several shapes, colors, and
  // sizes at once -- "Add line" fans out into one cart line per
  // shape x color x size combination.
  const [pickShapeIds, setPickShapeIds] = useState<number[]>([]);
  const [pickColorIds, setPickColorIds] = useState<number[]>([]);
  const [pickSizeIdxs, setPickSizeIdxs] = useState<number[]>([]);
  const [rangeMin, setRangeMin] = useState('');
  const [rangeMax, setRangeMax] = useState('');
  const [pickQty, setPickQty] = useState('');
  // Per-line, not per-order -- one requirement can mix Place Order and Request
  // Quotation lines. Defaults to Place Order, the more common/actionable case.
  const [pickRequestType, setPickRequestType] = useState<RequestType>('Place Order');
  const [justAdded, setJustAdded] = useState(0);
  const [toast, setToast] = useState('');

  // POSelector isn't remounted when a customer client-side-navigates from one
  // category page to another (same component, new categoryId prop) -- without
  // this, a shape/color/size picked on category A silently survives into
  // category B, where those ids can point at an unrelated shape/color/size, or
  // simply not exist in B's options at all (addLine then skips every combo and
  // used to still report "Added to your order"). Clear the picker whenever the
  // category actually changes, same as SpecialOrderComposer's key={categoryId}
  // achieves by remounting entirely.
  useEffect(() => {
    setPickShapeIds([]);
    setPickColorIds([]);
    setPickSizeIdxs([]);
    setRangeMin('');
    setRangeMax('');
    setPickQty('');
    setPickRequestType('Place Order');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  // Glass Pearls: the shape field isn't shown at all (see GLASS_PEARLS_CATEGORY_ID
  // above), so silently keep the selection pinned to Round instead of leaving it
  // empty -- nothing else could ever be picked here anyway.
  useEffect(() => {
    if (categoryId !== GLASS_PEARLS_CATEGORY_ID) return;
    const roundId = shapes.find((s) => s.name === 'Round')?.id;
    if (roundId && (pickShapeIds.length !== 1 || pickShapeIds[0] !== roundId)) setPickShapeIds([roundId]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, shapes]);

  useEffect(() => {
    if (active) {
      setCart(loadCart());
      setHydrated(true);
    }
  }, [active]);

  useEffect(() => {
    if (hydrated) saveCart(cart);
  }, [cart, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // Only sizes shared by every currently-selected shape -- so any size picked
  // here is guaranteed to have a matching shape_sizes row for each shape in
  // the combo, and "Add line" never has to silently skip a shape.
  const sizesForShapes = useMemo(() => {
    if (pickShapeIds.length === 0) return [];
    const bySizeMm = new Map<string, Size[]>();
    sizes.forEach((sz) => {
      if (!pickShapeIds.includes(sz.shape_id)) return;
      if (!bySizeMm.has(sz.size_mm)) bySizeMm.set(sz.size_mm, []);
      bySizeMm.get(sz.size_mm)!.push(sz);
    });
    const common: { sizeMm: string; rows: Size[] }[] = [];
    bySizeMm.forEach((rows, sizeMm) => {
      const shapeIdsCovered = new Set(rows.map((r) => r.shape_id));
      if (pickShapeIds.every((id) => shapeIdsCovered.has(id))) common.push({ sizeMm, rows });
    });
    // Numeric sizes first in ascending order, non-numeric (e.g. "6x8") after --
    // makes the range quick-pick predictable and the list easy to scan.
    return common.sort((a, b) => {
      const na = strictSizeNum(a.sizeMm);
      const nb = strictSizeNum(b.sizeMm);
      if (Number.isNaN(na) && Number.isNaN(nb)) return a.sizeMm.localeCompare(b.sizeMm);
      if (Number.isNaN(na)) return 1;
      if (Number.isNaN(nb)) return -1;
      return na - nb;
    });
  }, [sizes, pickShapeIds]);

  // Sizes are only offered when every selected shape has them, so it was
  // possible to pick three shapes, open the size list and be told there is no
  // size in common -- leaving the buyer to work out which shape to drop. Work
  // it out for them instead: once a shape is chosen, any shape that shares no
  // size with the current selection is greyed out in the shape list, with the
  // reason on the row, so an impossible combination can't be built at all.
  const incompatibleShapes = useMemo(
    () => incompatibleShapeIds(shapes, sizes.map((s) => ({ shapeId: s.shape_id, sizeMm: s.size_mm })), pickShapeIds),
    [pickShapeIds, shapes, sizes]
  );

  const sizeOptions = useMemo(
    () => sizesForShapes.map((g, i) => ({ id: i, hotIds: g.rows.map(row => row.id), name: `${g.sizeMm} mm` })),
    [sizesForShapes]
  );

  function applyRange() {
    const min = parseFloat(rangeMin);
    const max = parseFloat(rangeMax);
    if (Number.isNaN(min) || Number.isNaN(max)) {
      setToast('Enter both a min and max size in mm.');
      return;
    }
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    const matchIdxs = sizesForShapes
      .map((g, i) => ({ i, val: strictSizeNum(g.sizeMm) }))
      .filter((g) => !Number.isNaN(g.val) && g.val >= lo && g.val <= hi)
      .map((g) => g.i);

    if (matchIdxs.length === 0) {
      setToast(`No sizes between ${lo}–${hi} mm for these shapes.`);
      return;
    }
    setPickSizeIdxs((cur) => [...new Set([...cur, ...matchIdxs])]);
    setToast(`Selected ${matchIdxs.length} size${matchIdxs.length > 1 ? 's' : ''} between ${lo}-${hi}mm`);
    setRangeMin('');
    setRangeMax('');
  }

  const qtyNum = parseQuantity(pickQty) || 0;
  const isQuotation = pickRequestType === 'Request Quotation';
  // A quotation is asking what something would cost, so a quantity is not
  // required to send one. A purchase still needs one.
  const canAdd = pickShapeIds.length > 0 && pickColorIds.length > 0 && pickSizeIdxs.length > 0
    && (isQuotation || qtyNum > 0);
  const comboCount = pickShapeIds.length * pickColorIds.length * pickSizeIdxs.length;

  const pricingByCategory = useMemo(
    () => ({ ...otherPricing, ...(pricing ? { [categoryId]: pricing } : {}) }),
    [otherPricing, pricing, categoryId]
  );


  // Request Quotation is only offered when something in the current selection
  // has no price yet -- there is nothing to quote on an item whose price is
  // already published. Purchase stays available either way.
  const selectionHasUnpriced = useMemo(() => {
    if (!pickShapeIds.length || !pickColorIds.length || !pickSizeIdxs.length) return true;
    for (const shapeId of pickShapeIds) {
      for (const sizeIdx of pickSizeIdxs) {
        const match = sizesForShapes[sizeIdx]?.rows.find((r) => r.shape_id === shapeId);
        if (!match) continue;
        for (const colorId of pickColorIds) {
          if (cartLinePrice(pricingByCategory, { categoryId, shapeId, sizeId: match.id, colorId }) === null) return true;
        }
      }
    }
    return false;
  }, [pickShapeIds, pickColorIds, pickSizeIdxs, sizesForShapes, pricingByCategory, categoryId]);

  // The price of what is picked, shown before it is added -- a buyer used to
  // only learn it from the running total after adding. Only when every picked
  // combination has a price: a partial figure would read as the whole story.
  const selectionPrice = useMemo(() => {
    if (!pickShapeIds.length || !pickColorIds.length || !pickSizeIdxs.length) return null;
    const prices: number[] = [];
    for (const shapeId of pickShapeIds) {
      for (const sizeIdx of pickSizeIdxs) {
        const match = sizesForShapes[sizeIdx]?.rows.find((r) => r.shape_id === shapeId);
        if (!match) continue;
        for (const colorId of pickColorIds) {
          const p = cartLinePrice(pricingByCategory, { categoryId, shapeId, sizeId: match.id, colorId });
          if (p === null) return null;
          prices.push(p);
        }
      }
    }
    if (!prices.length) return null;
    return { min: Math.min(...prices), max: Math.max(...prices), sum: prices.reduce((a, b) => a + b, 0) };
  }, [pickShapeIds, pickColorIds, pickSizeIdxs, sizesForShapes, pricingByCategory, categoryId]);

  // Never leave the buyer stuck on a request type that is no longer offered.
  useEffect(() => {
    if (!selectionHasUnpriced && isQuotation) setPickRequestType('Place Order');
  }, [selectionHasUnpriced, isQuotation]);

  const totalPieces = cart.reduce((sum, i) => sum + i.qty, 0);

  // Fetch a price list for every other category sitting in the cart, once each.
  const missingPricingIds = useMemo(() => {
    const ids = new Set<number>();
    cart.forEach((item) => {
      if (item.categoryId !== categoryId && !otherPricing[item.categoryId]) ids.add(item.categoryId);
    });
    return Array.from(ids).sort((a, b) => a - b);
  }, [cart, categoryId, otherPricing]);

  const missingKey = missingPricingIds.join(',');
  useEffect(() => {
    if (!missingKey) return;
    let active = true;
    fetch(`/api/category-pricing?ids=${missingKey}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data?.pricing) return;
        // Merge rather than replace: the buyer may have added another
        // category while this request was in flight.
        setOtherPricing((prev) => ({ ...prev, ...data.pricing }));
      })
      .catch(() => { /* prices stay unresolved; lines still submit correctly */ });
    return () => { active = false; };
  }, [missingKey]);

  // Unit price is looked up live from the pricing map, not stored on the cart
  // item -- so it always reflects the current admin-set price, and categories
  // with no pricing set up yet just show nothing (no crash).
  function unitPriceInr(item: CartItem): number | null {
    // A quotation is a request for a price, so it never displays one and never
    // contributes to the estimated total -- even where the catalogue happens to
    // have a published price for that shape/size/colour.
    if (item.requestType === 'Request Quotation') return null;
    return cartLinePrice(pricingByCategory, item);
  }
  const cartTotalInr = cart.reduce((sum, item) => {
    const unit = unitPriceInr(item);
    return unit === null ? sum : sum + unit * item.qty;
  }, 0);
  const hasAnyPricedLine = cart.some((item) => unitPriceInr(item) !== null);
  const unpricedLines = cart.filter((item) => unitPriceInr(item) === null).length;

  // The dedupe rule itself lives in lib/cart-storage so /po/cart applies exactly
  // the same one; only the shape photo/icon enrichment is local, since this is
  // the one place that has the category's shape list to hand.
  function mergeIntoCart(current: CartItem[], item: CartItem): CartItem[] {
    const shape = shapes.find((s) => s.id === item.shapeId);
    return mergeCartLines(current, { ...item, shapeRefPhotoUrl: shape?.refPhotoUrl, shapeIconKey: shape?.iconKey });
  }

  // Clicking away commits whatever's currently checked (like a native <select>
  // dismissing on blur) -- only the explicit close button discards. Scoped to
  // this one panel's own DOM subtree so a click inside the nested IconSelect's
  // own popup (picking an option) never counts as "outside".


  // Everything the compose form is currently holding. Moissanite's colour is
  // locked to White (DEF) by the picker itself, so clearing it would only be
  // re-applied on the next render -- leave it alone rather than flicker.
  const hasSelection =
    pickShapeIds.length > 0 || pickSizeIdxs.length > 0 || pickQty !== '' ||
    rangeMin !== '' || rangeMax !== '' ||
    (categoryId !== 34 && pickColorIds.length > 0);

  function clearSelection() {
    setPickShapeIds([]);
    setPickSizeIdxs([]);
    if (categoryId !== 34) setPickColorIds([]);
    setRangeMin('');
    setRangeMax('');
    setPickQty('');
    setPickRequestType('Place Order');
  }

  function addLine() {
    if (!canAdd) {
      setToast('Pick at least one shape, color and size, and enter quantity first.');
      return;
    }

    let next = cart;
    let added = 0;

    for (const shapeId of pickShapeIds) {
      const shape = shapes.find((s) => s.id === shapeId);
      if (!shape) continue;
      for (const colorId of pickColorIds) {
        const color = colors.find((c) => c.id === colorId);
        if (!color) continue;
        for (const sizeIdx of pickSizeIdxs) {
          const group = sizesForShapes[sizeIdx];
          const match = group?.rows.find((r) => r.shape_id === shapeId);
          if (!match) continue; // shouldn't happen -- sizesForShapes is already the cross-shape intersection

          const item: CartItem = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            categoryId,
            categoryName,
            shapeId: shape.id,
            shapeName: shape.name,
            sizeId: match.id,
            sizeMm: match.size_mm,
            colorId: color.id,
            colorName: color.name,
            colorHex: color.hex || '#ccc',
            colorRefPhotoUrl: color.refPhotoUrl || null,
            qty: qtyNum,
            requestType: pickRequestType
          };
          next = mergeIntoCart(next, item);
          added++;
        }
      }
    }

    // Quotation lines may carry no quantity at all (0 = "not specified"), so
    // only purchase lines are held to a positive whole quantity.
    if (next.some((item) => item.requestType !== 'Request Quotation' && parseQuantity(String(item.qty)) === null)) {
      setToast('This would exceed the supported quantity for a line. Reduce the quantity and try again.');
      return;
    }
    if (next.some((item) => item.requestType === 'Request Quotation' && item.qty > 0 && parseQuantity(String(item.qty)) === null)) {
      setToast('This would exceed the supported quantity for a line. Reduce the quantity and try again.');
      return;
    }
    // Every shape/color/size combo was skipped (e.g. a stale selection left over
    // from switching categories no longer matches this category's options) --
    // never claim success when nothing was actually added.
    if (added === 0) {
      setToast('Those selections are no longer valid for this category. Please pick again.');
      return;
    }
    setCart(next);
    setJustAdded((n) => n + 1);
    setToast(added > 1 ? `Added ${added} lines to your order` : 'Added to your order');
    // Reset only size + qty so the same shape/color picks can be reused for the
    // next size quickly. Request type always returns to Purchase -- it is the
    // primary action, and a quotation is a deliberate per-line choice rather
    // than a mode the buyer should stay stuck in.
    setPickSizeIdxs([]);
    setPickQty('');
    setPickRequestType('Place Order');
  }






  return (
    <div className="po-wrap">
      <section className="po-card po-compose-card">
        <h2 className="po-heading">Add to Order</h2>
        <OrderReferenceCarousel colorChartUrl={colorChartUrl} photos={photos} categoryName={categoryName} shapeIds={pickShapeIds} colorIds={pickColorIds} sizeIds={pickSizeIdxs.flatMap(index=>sizesForShapes[index]?.rows.map(row=>row.id) || [])} shapes={shapes} colors={colors} />
        <div className="po-compose-fields">
        {!specialCategory(categoryId) && shapes.length === 0 ? (
          <div className="po-no-options">
            <p><strong>Sizes for {categoryName} are being added.</strong></p>
            <p>See the range under Explore Photos, or send us the shapes, sizes and quantities you need.</p>
            {whatsappNumber && (
              <a className="po-add-line-btn po-no-options-action" href={buildWhatsAppUrl(whatsappNumber, `Hi YOYO GEMS, I'd like to order ${categoryName}:\n`)} target="_blank" rel="noopener noreferrer">
                Message your requirement
              </a>
            )}
          </div>
        ) : specialCategory(categoryId) ? <SpecialOrderComposer key={categoryId} categoryId={categoryId} categoryName={categoryName} shapes={shapes} colors={colors} sizes={sizes.map(s=>({id:s.id,shapeId:s.shape_id,sizeMm:s.size_mm}))} onAdd={line=>{setCart(current=>mergeIntoCart(current,line));setJustAdded(n=>n+1);}} /> : <>
        <div className="po-add-form">
          <div>
            <label className="po-label">Color{pickColorIds.length > 1 ? 's' : ''}</label>
            <IconSelect
              categoryId={categoryId}
              multiple
              options={colors}
              locked={categoryId === 34}
              values={pickColorIds}
              onChange={setPickColorIds}
              placeholder="Choose color(s)"
              leading="swatch"
            />
          </div>
          {categoryId !== GLASS_PEARLS_CATEGORY_ID && <div>
            <label className="po-label">Shape{pickShapeIds.length > 1 ? 's' : ''}</label>
            <IconSelect
              categoryId={categoryId}
              multiple
              options={shapes}
              values={pickShapeIds}
              onChange={(v) => { setPickShapeIds(v); setPickSizeIdxs([]); }}
              placeholder="Choose shape(s)"
              leading="icon"
              disabledIds={incompatibleShapes}
              disabledReason={NO_SHARED_SIZE_REASON}
              disabledNote={NO_SHARED_SIZE_NOTE}
            />
          </div>}
          <div>
            <label className="po-label">Size{pickSizeIdxs.length > 1 ? 's' : ''} (mm)</label>
            <IconSelect
              categoryId={categoryId}
              multiple
              optionKind="size"
              options={sizeOptions}
              values={pickSizeIdxs}
              onChange={setPickSizeIdxs}
              placeholder={
                pickShapeIds.length === 0
                  ? 'Pick a shape first'
                  : sizeOptions.length === 0
                  ? 'No common size for these shapes'
                  : 'Choose size(s)'
              }
            />
            {pickShapeIds.length > 0 && (
              <div className="po-range-row">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Min"
                  aria-label="Minimum size in millimetres"
                  value={rangeMin}
                  onChange={(e) => setRangeMin(e.target.value)}
                />
                <span>to</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Max"
                  aria-label="Maximum size in millimetres"
                  value={rangeMax}
                  onChange={(e) => setRangeMax(e.target.value)}
                />
                <button type="button" className="po-inline-link" onClick={applyRange}>Select range</button>
              </div>
            )}
          </div>
          <div>
            <label className="po-label" htmlFor="po-new-quantity">Qty per line (pcs)</label>
            <input
              type="text"
              inputMode="numeric"
              className="po-qty-input"
              id="po-new-quantity"
              placeholder="e.g. 5000"
              value={pickQty}
              onChange={(e) => setPickQty(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>

        <div className="po-type-toggle" role="group" aria-label="Request type">
          <button
            type="button"
            aria-pressed={pickRequestType === 'Place Order'}
            className={pickRequestType === 'Place Order' ? 'active' : ''}
            onClick={() => setPickRequestType('Place Order')}
          >
            Purchase
          </button>
          <button
            type="button"
            aria-pressed={pickRequestType === 'Request Quotation'}
            aria-disabled={!selectionHasUnpriced || undefined}
            aria-describedby={selectionHasUnpriced ? undefined : 'po-type-priced-note'}
            className={`${pickRequestType === 'Request Quotation' ? 'active' : ''}${selectionHasUnpriced ? '' : ' po-type-unavailable'}`}
            onClick={() => { if (selectionHasUnpriced) setPickRequestType('Request Quotation'); }}
          >
            Request Quotation
          </button>
        </div>
        {isQuotation && <p className="po-type-hint">Quantity is optional for a quotation — we&rsquo;ll send prices, then you decide.</p>}
        {/* A tooltip never shows on a phone, so the reason is printed. */}
        {!selectionHasUnpriced && <p className="po-type-hint" id="po-type-priced-note">Price already listed — no quotation needed.</p>}
        {selectionPrice && (
          <p className="po-price-preview" role="status">
            <strong>₹{formatInr(selectionPrice.min)}{selectionPrice.max !== selectionPrice.min && <>–₹{formatInr(selectionPrice.max)}</>}</strong>
            {' '}per {priceUnitLabel(priceUnit)}
            {qtyNum > 0 && <> · est. ₹{Math.round(selectionPrice.sum * qtyNum).toLocaleString('en-IN')}</>}
          </p>
        )}

        <button type="button" className="po-add-line-btn" onClick={addLine} disabled={!canAdd}>
          + Add {comboCount > 1 ? `${comboCount} lines` : 'line'} to order
        </button>
        {canAdd && <p className="po-selection-summary" role="status">{comboCount.toLocaleString('en-IN')} {comboCount === 1 ? 'line' : 'lines'} × {qtyNum.toLocaleString('en-IN')} pcs = {(comboCount * qtyNum).toLocaleString('en-IN')} pcs to add</p>}
        {/* Adding a line deliberately keeps the shape and colour so several
            sizes can be added in a row; this is the way back to an empty form
            without reloading the page. Plain text, not a button -- it sits
            under the primary action and must not compete with it. */}
        {hasSelection && (
          <button type="button" className="po-clear-selection" onClick={clearSelection}>Clear selection</button>
        )}
        </>}
        </div>
      </section>

      {/* No photo grid here: the reference beside the controls above already
          shows what the buyer needs while choosing, and Explore Photos is where
          the full set lives. Repeating them here meant two carousels on one
          screen. */}

      {toast && <div className="po-toast" role="status" aria-live="polite">{toast}</div>}

      {/* Running total, always on screen once there's something to total, and
          the route through to the full requirement at /po/cart. */}
      {hydrated && cart.length > 0 && (
        <div className={`po-summary-bar${justAdded ? ' po-summary-bar--bump' : ''}`} key={justAdded}>
          <div className="po-summary-figures">
            <span className="po-summary-label">Your requirement</span>
            <span className="po-summary-counts">
              {cart.length} {cart.length === 1 ? 'line' : 'lines'} · {totalPieces.toLocaleString('en-IN')} pcs
            </span>
            {/* Its own line: squeezed onto the counts it was cut to "₹12,1…" on a phone. */}
            {hasAnyPricedLine && <span className="po-summary-total">₹{cartTotalInr.toLocaleString('en-IN')}</span>}
          </div>
          <Link href="/po/cart" className="po-summary-action">Review &amp; send</Link>
        </div>
      )}
    </div>
  );
}
