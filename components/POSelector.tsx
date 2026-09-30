'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import OrderReferenceCarousel from './OrderReferenceCarousel';
import type { OrderReferencePhoto } from '@/lib/order-reference-photos';
import SpecialOrderComposer from './SpecialOrderComposer';
import {specialCategory,specKey,specText,quantityFactor,categoryGrades,gradeSpec,type OrderSpecs} from '@/lib/order-specs';
import { useOrderPreferences } from './useOrderPreferences';
import IconSelect from './IconSelect';
import { allowedColorsOf, facetAvailability, keepAvailable, pickedSizeRows, sizeGroupsOf } from '@/lib/faceted-picker';
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
import { formatRupees } from '@/lib/money';
import { rememberedQty, rememberQty, type QuantityField } from '@/lib/quantity-field';

// Glass Pearls only ever comes in round -- the shape field is redundant noise for
// customers here, so it's hidden entirely and silently locked to Round rather than
// shown as a fixed/disabled field (contrast with Moissanite's locked color, which
// customers do still need to see spelled out).
const GLASS_PEARLS_CATEGORY_ID = 16;

type ShapeRef = { id: number; name: string; iconKey?: string | null; refPhotoUrl?: string | null };
type ColorRef = { id: number; name: string; hex?: string | null; refPhotoUrl?: string | null };
type Size = { id: number; shape_id: number; size_mm: string };

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
  priceUnit,
  optionLabel,
  sizeColors,
  quantityField
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
  /** What the "Color" field is called here ("Material" for Semi Precious Beads). */
  optionLabel?: string | null;
  /** [shape_size_id, color_id] pairs this category offers. Empty means every
      colour comes in every size, the rule for every other category. */
  sizeColors?: [number, number][];
  /** What the quantity field is called and starts on ("No. of Lines", 5). */
  quantityField?: QuantityField;
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
  // Where the quantity starts: the buyer's own last number for this category,
  // else the shop's default, else empty. Only categories with a default
  // remember -- elsewhere quantities vary too much line to line.
  const adminDefaultQty = quantityField?.defaultQty ?? null;
  const [startQty, setStartQty] = useState(adminDefaultQty ? String(adminDefaultQty) : '');
  const [pickQty, setPickQty] = useState(startQty);
  // Per-line, not per-order -- one requirement can mix Place Order and Request
  // Quotation lines. Defaults to Place Order, the more common/actionable case.
  const [pickRequestType, setPickRequestType] = useState<RequestType>('Place Order');
  const [justAdded, setJustAdded] = useState(0);
  const [toast, setToast] = useState('');
  // The cart as it was before the last "Add", so that add can be taken back.
  const [undo, setUndo] = useState<{ cart: CartItem[]; message: string } | null>(null);
  const undoCart = undo && undo.message === toast ? undo.cart : null;
  // Set when the buyer types something that isn't a whole number of pieces.
  const [qtyError, setQtyError] = useState(false);

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
    const start = adminDefaultQty ? String(rememberedQty(categoryId) ?? adminDefaultQty) : '';
    setStartQty(start);
    setPickQty(start);
    setQtyError(false);
    setPickRequestType('Place Order');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, adminDefaultQty]);

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
    // Longer when there is an Undo to reach, or a change to existing lines to read.
    const t = setTimeout(() => { setToast(''); setUndo(null); }, undoCart ? 6000 : 2200);
    return () => clearTimeout(t);
  }, [toast, undoCart]);

  // Shape, size and colour can be picked in any order: each list offers only
  // what goes with the picks already made in the other two (lib/faceted-picker).
  // Sizes are indexed into the category's full size list, so a size picked
  // before a shape stays picked when the shape is chosen.
  const sizeGroups = useMemo(
    () => sizeGroupsOf(sizes.map((s) => ({ ...s, shapeId: s.shape_id, sizeMm: s.size_mm }))),
    [sizes]
  );

  const label = optionLabel || 'Color';
  const lowerLabel = label.toLowerCase();
  // Categories like Semi Precious Beads list which materials each shape+size
  // comes in; there the material list and the shape/size lists narrow each other.
  const allowedBySize = useMemo(() => allowedColorsOf(sizeColors), [sizeColors]);
  const comboAllowed = (sizeId: number, colorId: number) => !allowedBySize || !!allowedBySize.get(sizeId)?.has(colorId);

  const available = useMemo(
    () => facetAvailability(shapes.map((s) => s.id), colors.map((c) => c.id), sizeGroups, allowedBySize,
      { shapeIds: pickShapeIds, sizeIdxs: pickSizeIdxs, colorIds: pickColorIds }),
    [shapes, colors, sizeGroups, allowedBySize, pickShapeIds, pickSizeIdxs, pickColorIds]
  );
  const shapeOptions = useMemo(() => shapes.filter((s) => available.shapeIds.has(s.id)), [shapes, available]);
  const colorOptions = useMemo(() => colors.filter((c) => available.colorIds.has(c.id)), [colors, available]);
  const sizeOptions = useMemo(
    () => sizeGroups
      .map((g, i) => ({ id: i, hotIds: g.rows.filter((r) => !pickShapeIds.length || pickShapeIds.includes(r.shape_id)).map((row) => row.id), name: `${g.sizeMm} mm` }))
      .filter((o) => available.sizeIdxs.has(o.id)),
    [sizeGroups, available, pickShapeIds]
  );

  // Picks only ever narrow the other lists, so this is a safety net for a
  // pick left over from data that has since changed, not a normal path.
  useEffect(() => {
    setPickShapeIds((cur) => keepAvailable(cur, available.shapeIds));
    setPickSizeIdxs((cur) => keepAvailable(cur, available.sizeIdxs));
    setPickColorIds((cur) => keepAvailable(cur, available.colorIds));
  }, [available]);

  // Among several shapes, a shape sharing no size with those already picked
  // is greyed out with the reason on the row, so an impossible combination
  // can't be built at all.
  const incompatibleShapes = useMemo(
    () => incompatibleShapeIds(shapes, sizes.map((s) => ({ shapeId: s.shape_id, sizeMm: s.size_mm })), pickShapeIds),
    [pickShapeIds, shapes, sizes]
  );

  const pickedRows = useMemo(() => pickedSizeRows(sizeGroups, pickSizeIdxs, pickShapeIds), [sizeGroups, pickSizeIdxs, pickShapeIds]);

  // Quality grade, for categories that offer one inside the category (Ruby
  // Corundum 5A / 7A). Starts on the buyer's usual grade for this category,
  // if they have one on file; required before a line can be added.
  const grades = categoryGrades(categoryId);
  const preferences = useOrderPreferences();
  const [pickGrade, setPickGrade] = useState('');
  const preferredGrade = preferences.find((p) => p.categoryId === categoryId && p.grade && grades.includes(p.grade))?.grade || '';
  useEffect(() => { if (preferredGrade) setPickGrade((g) => g || preferredGrade); }, [preferredGrade]);

  const qtyNum = parseQuantity(pickQty) || 0;
  const isQuotation = pickRequestType === 'Request Quotation';
  // A quotation is asking what something would cost, so a quantity is not
  // required to send one. A purchase still needs one.
  const canAdd = pickShapeIds.length > 0 && pickColorIds.length > 0 && pickSizeIdxs.length > 0
    && (isQuotation || qtyNum > 0) && (grades.length === 0 || grades.includes(pickGrade));
  const comboCount = useMemo(() => {
    if (!allowedBySize) return pickShapeIds.length * pickColorIds.length * pickSizeIdxs.length;
    let n = 0;
    for (const shapeId of pickShapeIds) for (const sizeIdx of pickSizeIdxs) {
      const match = sizeGroups[sizeIdx]?.rows.find((r) => r.shape_id === shapeId);
      if (match) n += pickColorIds.filter((colorId) => comboAllowed(match.id, colorId)).length;
    }
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedBySize, pickShapeIds, pickColorIds, pickSizeIdxs, sizeGroups]);

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
        const match = sizeGroups[sizeIdx]?.rows.find((r) => r.shape_id === shapeId);
        if (!match) continue;
        for (const colorId of pickColorIds) {
          if (!comboAllowed(match.id, colorId)) continue;
          if (cartLinePrice(pricingByCategory, { categoryId, shapeId, sizeId: match.id, colorId }) === null) return true;
        }
      }
    }
    return false;
  }, [pickShapeIds, pickColorIds, pickSizeIdxs, sizeGroups, pricingByCategory, categoryId]);

  // The price of what is picked, shown before it is added -- a buyer used to
  // only learn it from the running total after adding. Only when every picked
  // combination has a price: a partial figure would read as the whole story.
  const selectionPrice = useMemo(() => {
    if (!pickShapeIds.length || !pickColorIds.length || !pickSizeIdxs.length) return null;
    const prices: number[] = [];
    for (const shapeId of pickShapeIds) {
      for (const sizeIdx of pickSizeIdxs) {
        const match = sizeGroups[sizeIdx]?.rows.find((r) => r.shape_id === shapeId);
        if (!match) continue;
        for (const colorId of pickColorIds) {
          if (!comboAllowed(match.id, colorId)) continue;
          const p = cartLinePrice(pricingByCategory, { categoryId, shapeId, sizeId: match.id, colorId });
          if (p === null) return null;
          prices.push(p);
        }
      }
    }
    if (!prices.length) return null;
    return { min: Math.min(...prices), max: Math.max(...prices), sum: prices.reduce((a, b) => a + b, 0) };
  }, [pickShapeIds, pickColorIds, pickSizeIdxs, sizeGroups, pricingByCategory, categoryId]);

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
    pickShapeIds.length > 0 || pickSizeIdxs.length > 0 || pickQty !== startQty ||
    (categoryId !== 34 && pickColorIds.length > 0);

  const missingFields = [
    categoryId !== GLASS_PEARLS_CATEGORY_ID && pickShapeIds.length === 0 && 'shape',
    pickSizeIdxs.length === 0 && 'size',
    pickColorIds.length === 0 && lowerLabel,
    !isQuotation && qtyNum <= 0 && (quantityField?.label?.toLowerCase() || 'quantity')
  ].filter(Boolean) as string[];

  function clearSelection() {
    setPickShapeIds([]);
    setPickSizeIdxs([]);
    if (categoryId !== 34) setPickColorIds([]);
    setPickQty(startQty);
    setQtyError(false);
    setPickRequestType('Place Order');
  }

  function addLine() {
    if (!canAdd) {
      setToast(grades.length > 0 && !pickGrade ? `Choose a quality (${grades.join(' or ')}) first.` : `Pick at least one shape, ${lowerLabel} and size, and enter quantity first.`);
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
          const group = sizeGroups[sizeIdx];
          const match = group?.rows.find((r) => r.shape_id === shapeId);
          if (!match) continue; // shouldn't happen -- only sizes every picked shape has are offered
          if (!comboAllowed(match.id, color.id)) continue; // this shape/size doesn't come in this material

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
            requestType: pickRequestType,
            ...(grades.length > 0 && pickGrade ? { orderSpecs: gradeSpec(pickGrade) } : {})
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
    // A combination already in the requirement is merged into that line rather
    // than added twice -- say so, with the new total, since "Added 4 lines"
    // while two existing lines quietly grew read as an over-order.
    const grown = next.filter((item) => {
      const before = cart.find((c) => c.id === item.id);
      return before && before.qty !== item.qty;
    });
    const fresh = added - grown.length;
    const parts: string[] = [];
    if (fresh > 0) parts.push(fresh > 1 ? `Added ${fresh} lines` : 'Added 1 line');
    if (grown.length === 1) {
      const g = grown[0];
      parts.push(`${g.shapeName} ${g.sizeMm} mm ${g.colorName} was already in your order — now ${g.qty.toLocaleString('en-IN')}${quantityField?.label ? '' : ' pcs'}`);
    } else if (grown.length > 1) {
      parts.push(`${grown.length} lines were already in your order — quantities added to them`);
    }
    const message = parts.join(' · ');
    setUndo({ cart, message });
    setCart(next);
    setJustAdded((n) => n + 1);
    setToast(message);
    // Reset only size + qty so the same shape/color picks can be reused for the
    // next size quickly. Request type always returns to Purchase -- it is the
    // primary action, and a quotation is a deliberate per-line choice rather
    // than a mode the buyer should stay stuck in.
    setPickSizeIdxs([]);
    // With a default, the number just used becomes this buyer's starting
    // point here -- now and on later visits -- and stays in the box for the
    // next shape. Otherwise the box empties as before.
    if (adminDefaultQty && qtyNum > 0) {
      rememberQty(categoryId, qtyNum);
      setStartQty(String(qtyNum));
      setPickQty(String(qtyNum));
    } else {
      setPickQty(startQty);
    }
    setQtyError(false);
    setPickRequestType('Place Order');
  }






  const colorField = (
    <div>
      <label className="po-label">{label}{pickColorIds.length > 1 ? 's' : ''}</label>
      <IconSelect
        categoryId={categoryId}
        multiple
        options={colorOptions}
        locked={categoryId === 34}
        values={pickColorIds}
        onChange={setPickColorIds}
              closeOnFirstPick
        placeholder={colorOptions.length === 0 ? `No ${lowerLabel} for this shape and size` : `Choose ${lowerLabel}(s)`}
        leading="swatch"
      />
    </div>
  );

  return (
    <div className="po-wrap">
      <section className="po-card po-compose-card">
        <h2 className="po-heading">Add to Order</h2>
        <OrderReferenceCarousel colorChartUrl={colorChartUrl} photos={photos} categoryName={categoryName} shapeIds={pickShapeIds} colorIds={pickColorIds} sizeIds={pickedRows.map(row=>row.id)} shapes={shapes} colors={colors} />
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
          {grades.length > 0 && (
            <div>
              <label className="po-label" id="po-grade-label">Quality</label>
              <div className="po-type-toggle po-grade-toggle" role="group" aria-labelledby="po-grade-label">
                {grades.map((g) => (
                  <button key={g} type="button" aria-pressed={pickGrade === g} className={pickGrade === g ? 'active' : ''} onClick={() => setPickGrade(g)}>{g}</button>
                ))}
              </div>
            </div>
          )}
          {!allowedBySize && colorField}
          {categoryId !== GLASS_PEARLS_CATEGORY_ID && <div>
            <label className="po-label">Shape{pickShapeIds.length > 1 ? 's' : ''}</label>
            <IconSelect
              categoryId={categoryId}
              multiple
              options={shapeOptions}
              values={pickShapeIds}
              onChange={setPickShapeIds}
              closeOnFirstPick
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
              // A shape that comes in just one size shows that size, already
              // chosen and read-only -- there is nothing to pick.
              locked={pickShapeIds.length > 0 && sizeOptions.length === 1}
              placeholder={
                sizeOptions.length === 0
                  ? 'No size matches these picks'
                  : sizeOptions.length === 1
                  ? 'Size'
                  : 'Choose size(s)'
              }
            />
                      </div>
          {allowedBySize && colorField}
          <div>
            <label className="po-label" htmlFor="po-new-quantity">{quantityField?.label || 'Qty per line (pcs)'}</label>
            <input
              type="text"
              inputMode="numeric"
              className="po-qty-input"
              id="po-new-quantity"
              placeholder={adminDefaultQty ? `e.g. ${adminDefaultQty}` : 'e.g. 5000'}
              value={pickQty}
              aria-invalid={qtyError || undefined}
              aria-describedby={qtyError ? 'po-new-quantity-error' : undefined}
              onChange={(e) => {
                // Keep what was typed and flag it, rather than rewrite it:
                // stripping the "." turned 12.5 into 125. An invalid entry
                // parses to nothing, so Add stays off until it is fixed.
                const v = e.target.value;
                setPickQty(v);
                setQtyError(!/^\d*$/.test(v.trim()));
              }}
            />
            {qtyError && <p className="po-field-error" id="po-new-quantity-error" role="alert">{quantityField?.label ? `Whole numbers only — e.g. ${adminDefaultQty || 5}.` : 'Whole pieces only — enter a number like 500.'}</p>}
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
            <strong>₹{formatRupees(selectionPrice.min)}{selectionPrice.max !== selectionPrice.min && <>–₹{formatRupees(selectionPrice.max)}</>}</strong>
            {' '}per {priceUnitLabel(priceUnit)}
            {qtyNum > 0 && <> · est. ₹{formatRupees(selectionPrice.sum * qtyNum)}</>}
          </p>
        )}

        <button type="button" className="po-add-line-btn" onClick={addLine} disabled={!canAdd}>
          + Add {comboCount > 1 ? `${comboCount} lines` : 'line'} to order
        </button>
        {grades.length > 0 && !pickGrade && pickShapeIds.length > 0 && <p className="po-type-hint">Choose a quality ({grades.join(' or ')}) to add this.</p>}
        {/* A grey button alone doesn't say what's missing. Only once the buyer
            has started, so an untouched form isn't greeted with a to-do list. */}
        {!canAdd && hasSelection && missingFields.length > 0 && (
          <p className="po-type-hint po-missing-hint">Still needed: {missingFields.join(', ')}</p>
        )}
        {canAdd && (quantityField?.label
          ? <p className="po-selection-summary" role="status">{comboCount.toLocaleString('en-IN')} {comboCount === 1 ? 'item' : 'items'} to add · {quantityField.label}: {qtyNum.toLocaleString('en-IN')} each</p>
          : <p className="po-selection-summary" role="status">{comboCount.toLocaleString('en-IN')} {comboCount === 1 ? 'line' : 'lines'} × {qtyNum.toLocaleString('en-IN')} pcs = {(comboCount * qtyNum).toLocaleString('en-IN')} pcs to add</p>)}
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

      {toast && (
        <div className="po-toast" role="status" aria-live="polite">
          {toast}
          {undoCart && (
            <button type="button" className="po-toast-undo" onClick={() => { setCart(undoCart); setUndo(null); setToast('Undone — your order is as it was'); }}>
              Undo
            </button>
          )}
        </div>
      )}

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
            {hasAnyPricedLine && <span className="po-summary-total">₹{formatRupees(cartTotalInr)}</span>}
          </div>
          <Link href="/po/cart" className="po-summary-action">Review &amp; send</Link>
        </div>
      )}
    </div>
  );
}
