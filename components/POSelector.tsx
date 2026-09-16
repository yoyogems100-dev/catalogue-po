'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import OrderReferenceCarousel from './OrderReferenceCarousel';
import type { OrderReferencePhoto } from '@/lib/order-reference-photos';
import SpecialOrderComposer from './SpecialOrderComposer';
import {specialCategory,specKey,specText,quantityFactor,type OrderSpecs} from '@/lib/order-specs';
import IconSelect from './IconSelect';
import ColorSwatch from './ColorSwatch';
import ShapeReferenceImage from './ShapeReferenceImage';
import type { CategoryPricing } from '@/lib/pricing-calc';
import { cartLinePrice } from '@/lib/pricing-calc';
import { parseQuantity } from '@/lib/quantity';
import QuantityInput from './QuantityInput';

// Glass Pearls only ever comes in round -- the shape field is redundant noise for
// customers here, so it's hidden entirely and silently locked to Round rather than
// shown as a fixed/disabled field (contrast with Moissanite's locked color, which
// customers do still need to see spelled out).
const GLASS_PEARLS_CATEGORY_ID = 16;

type ShapeRef = { id: number; name: string; iconKey?: string | null; refPhotoUrl?: string | null };
type ColorRef = { id: number; name: string; hex?: string | null; refPhotoUrl?: string | null };
type Size = { id: number; shape_id: number; size_mm: string };

type RequestType = 'Place Order' | 'Request Quotation';

type CartItem = {
  orderSpecs?: OrderSpecs;
  id: string;
  categoryId: number;
  categoryName: string;
  shapeId: number;
  shapeName: string;
  shapeRefPhotoUrl?: string | null;
  shapeIconKey?: string | null;
  sizeId: number | null;
  sizeMm: string;
  colorId: number;
  colorName: string;
  colorHex: string;
  colorRefPhotoUrl?: string | null;
  qty: number;
  requestType: RequestType;
};

// Matches a plain "1" / "1.5", or a compound "AxB"/"A*B" (x/X/* used
// interchangeably) -- range-select and sort both key off the leading
// number either way, so "4x6" sits with "4" and a 4x6-to-8x6 range picks
// up every compound size whose first dimension falls in that span.
function strictSizeNum(s: string): number {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*(?:[xX*]\s*\d+(?:\.\d+)?)?$/);
  return m ? parseFloat(m[1]) : NaN;
}

const CART_KEY = 'yoyo_po_cart_v2';

function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCart(cart: CartItem[]) {
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    // storage full or disabled -- cart still works in-memory for this session
  }
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
  pricing
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
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [comment, setComment] = useState('');
  const reviewDialog = useRef<HTMLDialogElement>(null);
  // "Add line" happens at the top of the page while the requirement panel sits
  // below the fold, so on a phone nothing visibly changed when a buyer added
  // lines. The summary bar is always on screen and flashes on each add.
  const cartPanel = useRef<HTMLElement>(null);
  const [justAdded, setJustAdded] = useState(0);
  const submissionPending = useRef(false);
  const [reviewing, setReviewing] = useState(false);
  useEffect(() => { if (reviewing) reviewDialog.current?.showModal(); }, [reviewing]);
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState<{ id: number; whatsappUrl: string; quotation: boolean } | null>(null);
  const [toast, setToast] = useState('');
  const [editingOption, setEditingOption] = useState<{ itemId: string; kind: 'size' | 'color'; values: number[] } | null>(null);

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
    setEditingOption(null);
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
  // size with the current selection is greyed out in the shape list, so an
  // impossible combination can't be built in the first place.
  const sizeMmByShape = useMemo(() => {
    const map = new Map<number, Set<string>>();
    sizes.forEach((sz) => {
      if (!map.has(sz.shape_id)) map.set(sz.shape_id, new Set());
      map.get(sz.shape_id)!.add(sz.size_mm);
    });
    return map;
  }, [sizes]);

  const incompatibleShapeIds = useMemo(() => {
    if (pickShapeIds.length === 0) return [];
    // Sizes shared by everything picked so far.
    let shared: Set<string> | null = null;
    pickShapeIds.forEach((id) => {
      const own = sizeMmByShape.get(id) || new Set<string>();
      shared = shared === null ? new Set(own) : new Set([...shared].filter((mm) => own.has(mm)));
    });
    // Already an impossible selection (nothing shared) -- don't compound it by
    // greying out the whole list; the buyer needs to be able to deselect.
    if (!shared || shared.size === 0) return [];
    return shapes
      .filter((s) => !pickShapeIds.includes(s.id))
      .filter((s) => {
        const own = sizeMmByShape.get(s.id);
        if (!own) return true;
        return ![...shared!].some((mm) => own.has(mm));
      })
      .map((s) => s.id);
  }, [pickShapeIds, shapes, sizeMmByShape]);

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
      setToast(`No existing sizes between ${lo}-${hi}mm for these shapes -- add that size in Admin first.`);
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

  function mergeIntoCart(current: CartItem[], item: CartItem): CartItem[] {
    const existing = current.find(
      (i) =>
        i.categoryId === item.categoryId &&
        i.shapeId === item.shapeId &&
        i.colorId === item.colorId &&
        i.sizeId === item.sizeId &&
        i.requestType === item.requestType && specKey(i.orderSpecs) === specKey(item.orderSpecs)
    );
    if (existing) {
      return current.map((i) => (i.id === existing.id ? { ...i, qty: i.qty + item.qty } : i));
    }
    const shape = shapes.find(s => s.id === item.shapeId);
    return [...current, {...item, shapeRefPhotoUrl: shape?.refPhotoUrl, shapeIconKey: shape?.iconKey}];
  }

  // Clicking away commits whatever's currently checked (like a native <select>
  // dismissing on blur) -- only the explicit close button discards. Scoped to
  // this one panel's own DOM subtree so a click inside the nested IconSelect's
  // own popup (picking an option) never counts as "outside".
  function ItemOptionEditor({ item, editingOption, onApply, onDiscard }: {
    item: CartItem;
    editingOption: { itemId: string; kind: 'size' | 'color'; values: number[] };
    onApply: () => void;
    onDiscard: () => void;
  }) {
    const panelRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      function onDocMouseDown(e: MouseEvent) {
        if (panelRef.current && !panelRef.current.contains(e.target as Node)) onApply();
      }
      document.addEventListener('mousedown', onDocMouseDown);
      return () => document.removeEventListener('mousedown', onDocMouseDown);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onApply]);

    return (
      <div className="po-item-option-editor" ref={panelRef}>
        <button type="button" className="po-item-option-close" aria-label="Close without saving" onClick={onDiscard}>&times;</button>
        <div className="po-item-option-row">
          <IconSelect
            categoryId={item.categoryId}
            multiple
            optionKind={editingOption.kind === 'size' ? 'size' : undefined}
            options={editingOption.kind === 'size'
              ? sizes.filter((option) => option.shape_id === item.shapeId).map((option) => ({ id: option.id, name: `${option.size_mm} mm` }))
              : colors}
            values={editingOption.values}
            onChange={(values) => setEditingOption({ ...editingOption, values })}
            placeholder={editingOption.kind === 'size' ? 'Choose sizes' : 'Choose colors'}
            leading={editingOption.kind === 'color' ? 'swatch' : undefined}
          />
          <button type="button" className="btn" onClick={onApply}>Apply</button>
        </div>
        <p>Select one or more. Clearing all removes this line.</p>
      </div>
    );
  }

  function StoneReference({item}:{item:CartItem}) {
    // A real photo of this shape -- this category's own upload, or the shared
    // default (e.g. Moissanite's gemstone photos, close enough across categories
    // that a dedicated photo per category isn't needed) -- or the vector outline.
    // Never the color's own photo: that would show a photo of the wrong thing
    // labeled as the shape. Glass Pearls is the one deliberate exception: shape is
    // always Round and never shown to the customer, so the color -- the thing that
    // actually varies -- is the meaningful image here instead.
    const src = item.categoryId === GLASS_PEARLS_CATEGORY_ID
      ? (item.colorRefPhotoUrl || item.shapeRefPhotoUrl)
      : (item.shapeRefPhotoUrl || (item.categoryId === categoryId ? shapes.find(s=>s.id===item.shapeId)?.refPhotoUrl : null));
    return <span className="requirement-stone"><ShapeReferenceImage name={item.shapeName} src={src} iconKey={item.shapeIconKey || shapes.find(s=>s.id===item.shapeId)?.iconKey} fallbackSize={36} /></span>;
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
    setReceipt(null);
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

  function updateQty(id: string, qty: number) {
    setCart(cart.map((i) => {
      if (i.id !== id) return i;
      // 0 means "not specified" and is only a valid answer on a quotation.
      const floor = i.requestType === 'Request Quotation' ? 0 : 1;
      return { ...i, qty: Math.max(floor, qty) };
    }));
  }

  function updateItemRequestType(id: string, requestType: RequestType) {
    setCart(cart.map((i) => (i.id === id ? { ...i, requestType } : i)));
  }

  function removeItem(id: string) {
    setCart(cart.filter((i) => i.id !== id));
  }

  function replaceItemOptions(item: CartItem, nextSizeIds: number[], nextColorIds: number[]) {
    let next = cart.filter((line) => line.id !== item.id);
    for (const sizeId of nextSizeIds) {
      const size = sizes.find((option) => option.id === sizeId && option.shape_id === item.shapeId);
      if (!size) continue;
      for (const colorId of nextColorIds) {
        const color = colors.find((option) => option.id === colorId);
        if (!color) continue;
        next = mergeIntoCart(next, {
          ...item,
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          sizeId: size.id,
          sizeMm: size.size_mm,
          colorId: color.id,
          colorName: color.name,
          colorHex: color.hex || '#ccc',
          colorRefPhotoUrl: color.refPhotoUrl || null,
        });
      }
    }
    setCart(next);
    setEditingOption(null);
  }

  async function sendRequirement() {
    if (submissionPending.current) return;
    if (cart.length === 0) {
      setToast('Add at least one line to your order first.');
      return;
    }
    submissionPending.current = true;
    setSending(true);
    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart, contactName, contactPhone, comment })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save order');

      const number = (whatsappNumber || '').replace(/\D/g, '');
      const url = number
        ? `https://wa.me/${number}?text=${encodeURIComponent(data.message)}`
        : `https://wa.me/?text=${encodeURIComponent(data.message)}`;
      setReceipt({ id: data.orderId, whatsappUrl: url, quotation: cart.every(item => item.requestType === 'Request Quotation') });

      setReviewing(false);
      setCart([]);
      setComment('');
      setToast(`Order #${data.orderId} saved successfully.`);
    } catch (err: any) {
      setToast(err.message || 'Something went wrong. Please try again.');
    } finally {
      submissionPending.current = false;
      setSending(false);
    }
  }

  return (
    <div className="po-wrap">
      <section className={`po-card po-compose-card ${(photos.some(photo=>photo.url) || colorChartUrl) ? "po-compose-with-reference" : ""}`}>
        <h2 className="po-heading">Add to Order</h2>
        <OrderReferenceCarousel colorChartUrl={colorChartUrl} photos={photos} categoryName={categoryName} shapeIds={pickShapeIds} colorIds={pickColorIds} sizeIds={pickSizeIdxs.flatMap(index=>sizesForShapes[index]?.rows.map(row=>row.id) || [])} shapes={shapes} colors={colors} />
        <div className="po-compose-fields">
        {specialCategory(categoryId) ? <SpecialOrderComposer key={categoryId} categoryId={categoryId} categoryName={categoryName} shapes={shapes} colors={colors} sizes={sizes.map(s=>({id:s.id,shapeId:s.shape_id,sizeMm:s.size_mm}))} onAdd={line=>{setCart(current=>mergeIntoCart(current,line));setReceipt(null);}} /> : <>
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
              disabledIds={incompatibleShapeIds}
              disabledReason="No size in common with the shapes already selected"
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
            title={selectionHasUnpriced ? undefined : 'These items already have a published price'}
            className={`${pickRequestType === 'Request Quotation' ? 'active' : ''}${selectionHasUnpriced ? '' : ' po-type-unavailable'}`}
            onClick={() => { if (selectionHasUnpriced) setPickRequestType('Request Quotation'); }}
          >
            Request Quotation
          </button>
        </div>
        {isQuotation && <p className="po-type-hint">Quantity is optional for a quotation — we&rsquo;ll send prices, then you decide.</p>}

        <button type="button" className="po-add-line-btn" onClick={addLine} disabled={!canAdd}>
          + Add {comboCount > 1 ? `${comboCount} lines` : 'line'} to order
        </button>
        {canAdd && <p className="po-selection-summary" role="status">{comboCount.toLocaleString('en-IN')} {comboCount === 1 ? 'line' : 'lines'} × {qtyNum.toLocaleString('en-IN')} pcs = {(comboCount * qtyNum).toLocaleString('en-IN')} pcs to add</p>}
        </>}
        </div>
      </section>

      <section className="po-card po-cart-card" ref={cartPanel}>
        <div className="po-cart-head">
          <h2 className="po-heading">Your Requirement</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="po-cart-badge">{cart.length} {cart.length === 1 ? 'line' : 'lines'} · {totalPieces.toLocaleString('en-IN')} pcs</span>
            {cart.length > 0 && (
              <button
                type="button"
                className="btn-ghost po-clear-cart-btn"
                onClick={() => { if (confirm('Clear every line from your requirement?')) setCart([]); }}
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {cart.length === 0 ? (
          <div className="po-empty po-empty-cart">Your requirement is empty. Choose your options above, then add a line to get started.</div>
        ) : (
          <div className="po-requirement-groups">
            {([
              { type: 'Place Order' as RequestType, title: 'Purchase', moveLabel: null },
              { type: 'Request Quotation' as RequestType, title: 'Request quotation', moveLabel: 'Move to purchase' },
            ]).map((group) => {
              const groupItems = cart.filter((item) => item.requestType === group.type);
              if (groupItems.length === 0) return null;
              const groupPieces = groupItems.reduce((sum, item) => sum + item.qty, 0);
              // New lines are pushed onto the end of `cart`, so walking it in reverse
              // surfaces the most recently added line -- and, since that's also the
              // first time we see its category, the most recently touched category --
              // first. Items within a category keep that same newest-first order.
              const categoryGroups: { categoryId: number; categoryName: string; items: CartItem[] }[] = [];
              const categoryIndex = new Map<number, number>();
              for (const item of [...groupItems].reverse()) {
                if (!categoryIndex.has(item.categoryId)) {
                  categoryIndex.set(item.categoryId, categoryGroups.length);
                  categoryGroups.push({ categoryId: item.categoryId, categoryName: item.categoryName, items: [] });
                }
                categoryGroups[categoryIndex.get(item.categoryId)!].items.push(item);
              }
              return <section className="po-requirement-group" key={group.type} aria-label={group.title}>
                <header className="po-requirement-group-head">
                  <h3>{group.title}</h3>
                  <span>{groupItems.length} {groupItems.length === 1 ? 'line' : 'lines'} · {groupPieces.toLocaleString('en-IN')} pcs</span>
                </header>
                {categoryGroups.map((catGroup) => (
                <div className="po-requirement-category" key={catGroup.categoryId}>
                  <div className="po-requirement-category-head">
                    <strong>{catGroup.categoryName}</strong>
                    <span>{catGroup.items.length} {catGroup.items.length === 1 ? 'line' : 'lines'}</span>
                  </div>
                  <div className="po-item-list">
            {catGroup.items.map((item) => {
              const unit = unitPriceInr(item);
              return (
              <div key={item.id} className="po-item-row">
                <StoneReference item={item} />
                <div className="po-item-details">
                  <strong>{item.categoryId !== GLASS_PEARLS_CATEGORY_ID && `${item.shapeName} · `}{item.categoryId === categoryId && !item.orderSpecs && item.sizeId ? <button type="button" className="po-item-option-link" onClick={() => setEditingOption({ itemId: item.id, kind: 'size', values: [item.sizeId!] })}>{item.sizeMm}mm</button> : `${item.sizeMm}mm`}</strong>
                  <span>
                    {/* Category now lives in the group header above, not repeated per line.
                        Glass Pearls' main image (StoneReference) is already the color's own
                        photo -- a swatch here would just show the same picture twice. */}
                    {item.categoryId !== GLASS_PEARLS_CATEGORY_ID && <ColorSwatch hex={item.colorHex} refPhotoUrl={item.colorRefPhotoUrl} name={item.colorName} size={13} />}
                    {item.categoryId === categoryId && !item.orderSpecs
                      ? <button type="button" className="po-item-option-link" onClick={() => setEditingOption({ itemId: item.id, kind: 'color', values: [item.colorId] })}>{item.colorName}</button>
                      : item.colorName}{item.orderSpecs && <small style={{display:"block"}}>{specText(item.orderSpecs,item.qty)}</small>}
                  </span>
                  {unit !== null && (
                    <span className="mono po-item-price">&#8377;{unit.toFixed(2)} &times; {item.qty} = &#8377;{(unit * item.qty).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  )}
                  {group.moveLabel && <button
                    type="button"
                    className="po-item-move-btn"
                    onClick={() => updateItemRequestType(item.id, 'Place Order')}
                  >
                    {group.moveLabel}
                  </button>}
                </div>
                {item.requestType === 'Request Quotation' && item.qty === 0 ? (
                  // Quantity is optional on a quotation; offer it rather than
                  // demand it, so the line can be sent as a pure price enquiry.
                  <label className="po-item-qty"><span>Qty (optional)</span>
                    <QuantityInput
                      value={0}
                      allowEmpty
                      placeholder="Any"
                      label={`Optional quantity for ${item.shapeName} ${item.sizeMm} mm ${item.colorName}`}
                      onChange={(quantity) => updateQty(item.id, quantity * quantityFactor(item.orderSpecs))}
                      onInvalid={() => setToast('Enter a positive whole quantity, or leave it blank for a quotation.')}
                    />
                  </label>
                ) : (
                <label className="po-item-qty"><span>Qty ({item.orderSpecs?.kind==='rainbow'?'strips':'pcs'})</span>
                <QuantityInput
                  value={item.qty / quantityFactor(item.orderSpecs)}
                  label={`Quantity for ${item.shapeName} ${item.sizeMm} mm ${item.colorName}`}
                  onChange={(quantity) => updateQty(item.id, quantity * quantityFactor(item.orderSpecs))}
                  onInvalid={() => setToast('Enter a positive whole quantity. The previous quantity has been kept.')}
                />
                </label>
                )}
                <button type="button" className="po-remove-btn" aria-label={`Remove ${item.shapeName} ${item.sizeMm} mm ${item.colorName}`} onClick={() => removeItem(item.id)}>&times;</button>
                {editingOption?.itemId === item.id && <ItemOptionEditor
                  item={item}
                  editingOption={editingOption}
                  onDiscard={() => setEditingOption(null)}
                  onApply={() => replaceItemOptions(
                    item,
                    editingOption.kind === 'size' ? editingOption.values : (item.sizeId ? [item.sizeId] : []),
                    editingOption.kind === 'color' ? editingOption.values : [item.colorId]
                  )}
                />}
              </div>
              );
            })}
                  </div>
                </div>
                ))}
              </section>;
            })}
          </div>
        )}
        {hasAnyPricedLine && (
          <div className="po-cart-total mono">
            {unpricedLines ? 'Priced lines subtotal' : 'Estimated total'}: &#8377;{cartTotalInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            {unpricedLines > 0 && <small className="po-price-note">{unpricedLines} {unpricedLines === 1 ? 'line requires' : 'lines require'} price confirmation. Final pricing is confirmed when processed.</small>}
          </div>
        )}

        {receipt && <div className="po-card" role="status" aria-live="polite">
          <h3>{receipt.quotation ? 'Quotation requested' : 'Order placed'} — #{receipt.id}</h3>
          <p>Our team will confirm pricing and availability. Your submission has been saved.</p>
          <p><a href={`/account/orders/${receipt.id}`}>View in My Orders (sign in)</a></p>
          {!loggedIn && <p>Guest orders appear in My Orders when you sign in with the WhatsApp number provided. Without a number, keep this reference and contact our team.</p>}
          <a className="btn-ghost" href={receipt.whatsappUrl} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
        </div>}
        <div className="po-send-box">
          {!loggedIn && <div className="po-send-row">
            <label>
              Name / company
              <input type="text" autoComplete="organization" placeholder="Your name or business (optional)" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </label>
            <label>
              WhatsApp number (optional)
              <input type="tel" autoComplete="tel" placeholder="e.g. 9079914601" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </label>
          </div>}
          <label className="po-block-label">
            Additional comment
            <textarea rows={3} placeholder="Message" value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          <p className="po-send-help">Our team will confirm pricing and availability.{!loggedIn && ' Add your WhatsApp number for updates.'}</p>
          <button type="button" className="po-send-btn" onClick={() => { setToast(''); setReviewing(true); }} disabled={sending || cart.length === 0}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m3 3 18 9-18 9 4-9-4-9Zm4 9h14" /></svg>
            {sending ? 'Submitting…' : cart.length === 0 && receipt ? (receipt.quotation ? 'Quotation requested' : 'Order placed') : 'Send requirement'}
          </button>
        </div>
      </section>

      {reviewing && <dialog ref={reviewDialog} className="order-review-dialog" aria-labelledby="order-review-title"
        onCancel={(event) => { event.preventDefault(); if (!sending) setReviewing(false); }}>
        <h2 id="order-review-title">Confirm your requirement</h2>
        <p>{cart.length} lines · {cart.reduce((sum, item) => sum + item.qty, 0).toLocaleString('en-IN')} pieces</p>
        <ul className="order-review-lines">{[...cart].reverse().map(item => <li key={item.id}><StoneReference item={item} /><div>
          <strong>{item.categoryName}</strong><br />{item.categoryId !== GLASS_PEARLS_CATEGORY_ID && `${item.shapeName} · `}{item.sizeMm} mm · {item.colorName}{item.orderSpecs && <small style={{display:"block"}}>{specText(item.orderSpecs,item.qty)}</small>}<br />
          {item.qty > 0 ? `${item.qty.toLocaleString('en-IN')} pieces` : 'Quantity not specified'} · {item.requestType === 'Request Quotation' ? 'Request quotation' : 'Purchase'}
        </div></li>)}</ul>
        {hasAnyPricedLine && <p>{unpricedLines ? 'Priced lines subtotal' : 'Estimated total'}: ₹{cartTotalInr.toLocaleString('en-IN')}</p>}
        {loggedIn ? <p>Your saved account details will be used for this requirement.</p> : <p><strong>Contact:</strong> {contactName || 'Not provided'}<br />WhatsApp: {contactPhone || 'Not provided'}</p>}
        {comment && <p style={{ whiteSpace: 'pre-wrap' }}><strong>Comment:</strong> {comment}</p>}
        <p>Our team will confirm pricing and availability before your order is confirmed.</p>
        <div className="order-review-actions">
          <button className="btn-ghost" onClick={() => setReviewing(false)} disabled={sending}>Back to edit</button>
          <button className="btn" onClick={sendRequirement} disabled={sending}>{sending ? 'Submitting…' : 'Send requirement'}</button>
        </div>
        {toast && <p role="status">{toast}</p>}
      </dialog>}
      {toast && !reviewing && <div className="po-toast" role="status" aria-live="polite">{toast}</div>}

      {/* Running total, always on screen once there's something to total. It is
          deliberately a summary, not a second cart: tapping it takes the buyer
          to the real requirement panel rather than duplicating it. */}
      {hydrated && cart.length > 0 && !receipt && (
        <div className={`po-summary-bar${justAdded ? ' po-summary-bar--bump' : ''}`} key={justAdded}>
          <div className="po-summary-figures">
            <span className="po-summary-label">Your requirement</span>
            <span className="po-summary-counts mono">
              {cart.length} {cart.length === 1 ? 'line' : 'lines'} · {totalPieces.toLocaleString('en-IN')} pcs
              {hasAnyPricedLine && <> · ₹{cartTotalInr.toLocaleString('en-IN')}</>}
            </span>
          </div>
          <button
            type="button"
            className="po-summary-action"
            onClick={() => cartPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            Review
          </button>
        </div>
      )}
    </div>
  );
}
