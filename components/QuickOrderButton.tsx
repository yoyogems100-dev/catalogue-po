'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import IconSelect from './IconSelect';
import ColorSwatch from './ColorSwatch';
import { incompatibleShapeIds, NO_SHARED_SIZE_NOTE, NO_SHARED_SIZE_REASON } from '@/lib/shape-size-compat';
import SpecialOrderComposer from './SpecialOrderComposer';
import OrderReferenceCarousel from './OrderReferenceCarousel';
import type { OrderReferencePhoto } from '@/lib/order-reference-photos';
import { specialCategory, specText, quantityFactor, categoryGrades, gradeSpec } from '@/lib/order-specs';
import { COLOR_FAMILIES, colorFamilyId } from '@/lib/color-family';
import { preferenceForFamily } from '@/lib/customer-preferences';
import { useOrderPreferences } from './useOrderPreferences';

/** Home-page colour chips open Quick Order already started on a colour. */
export const QUICK_ORDER_COLOR_EVENT = 'yoyo:quick-order-color';
import { categoryIconUrl } from '@/lib/category-icons';
import type { CategoryPricing } from '@/lib/pricing-calc';
import { loadCart, saveCart, mergeIntoCart, cartPieces, type CartItem, type RequestType } from '@/lib/cart-storage';

type CategoryOption = { id: number; name: string; slug: string };
type CategoryOptionsData = {
  shapes: { id: number; name: string; iconKey?: string | null; refPhotoUrl?: string | null }[];
  colors: { id: number; name: string; hex?: string | null; refPhotoUrl?: string | null }[];
  sizes: { id: number; shapeId: number; sizeMm: string }[];
  photos: OrderReferencePhoto[];
  colorChartUrl?: string | null;
  pricing?: CategoryPricing;
};

// Matches a plain "1" / "1.5", or a compound "AxB"/"A*B" -- same rule as the
// category-page picker, so a mixed size list sorts the same way everywhere.
function strictSizeNum(s: string): number {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*(?:[xX*]\s*\d+(?:\.\d+)?)?$/);
  return m ? parseFloat(m[1]) : NaN;
}

/**
 * A self-contained "Quick Order" trigger + pop-up, in the spirit of ColorChart
 * or CartBag: it owns its own open state and writes straight to the shared
 * cart (lib/cart-storage.ts), so it can be dropped in anywhere -- the account
 * header, the cart page -- without any page needing to fetch categories or
 * manage cart state itself. Adding a line here doesn't leave the pop-up; it
 * resets shape/color/size/qty so several lines can be added back to back,
 * same as the category-page builder.
 */
export default function QuickOrderButton({ label = 'Quick Order', listenForColorStart = false }: { label?: string; listenForColorStart?: boolean }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  const [allCategories, setAllCategories] = useState<CategoryOption[] | null>(null);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [optionsCache, setOptionsCache] = useState<Record<number, CategoryOptionsData>>({});
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [pickCategoryId, setPickCategoryId] = useState<number | ''>('');
  const [pickShapeIds, setPickShapeIds] = useState<number[]>([]);
  const [pickColorIds, setPickColorIds] = useState<number[]>([]);
  const [pickSizeIdxs, setPickSizeIdxs] = useState<number[]>([]);
  const [pickQty, setPickQty] = useState('');
  const [pickRequestType, setPickRequestType] = useState<RequestType>('Place Order');
  const [addedCount, setAddedCount] = useState(0);
  const [message, setMessage] = useState('');
  const [cartCount, setCartCount] = useState(0);

  // Colour-first ordering: "Red" + the buyer's usual picks -> Ruby Corundum 5A.
  const preferences = useOrderPreferences();
  const [pickFamily, setPickFamily] = useState<number | null>(null);
  const [pickGrade, setPickGrade] = useState('');
  const [pendingCategoryId, setPendingCategoryId] = useState<number | null>(null);

  function chooseFamily(familyId: number | null) {
    setPickFamily(familyId);
    setPickColorIds([]);
    setMessage('');
    const pref = familyId ? preferenceForFamily(preferences, familyId) : null;
    if (pref) setPendingCategoryId(pref.categoryId);
  }

  // The category list may still be loading when a colour is chosen (a home
  // chip opens the dialog and picks in one go), so the jump waits for it.
  useEffect(() => {
    if (pendingCategoryId == null || !allCategories) return;
    const id = pendingCategoryId;
    setPendingCategoryId(null);
    if (allCategories.some((c) => c.id === id)) void handleCategoryChange(String(id), { keepFamily: true });
  }, [pendingCategoryId, allCategories]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!listenForColorStart) return;
    function onStart(e: Event) {
      const familyId = Number((e as CustomEvent).detail?.familyId);
      setOpen(true);
      if (familyId) chooseFamily(familyId);
    }
    window.addEventListener(QUICK_ORDER_COLOR_EVENT, onStart);
    return () => window.removeEventListener(QUICK_ORDER_COLOR_EVENT, onStart);
  }); // re-bound each render so chooseFamily sees the latest preferences

  useEffect(() => { if (open && !dialog.current?.open) dialog.current?.showModal(); }, [open]);

  useEffect(() => {
    if (!open || allCategories || loadingCategories) return;
    setLoadingCategories(true);
    fetch('/api/app/categories')
      .then((res) => res.json())
      .then((data) => setAllCategories((data.categories || []).map((c: any) => ({ id: c.id, name: c.name, slug: c.slug }))))
      .catch(() => setAllCategories([]))
      .finally(() => setLoadingCategories(false));
  }, [open, allCategories, loadingCategories]);

  function close() { dialog.current?.close(); }

  function reset() {
    setPickFamily(null);
    setPickGrade('');
    setPendingCategoryId(null);
    setPickCategoryId('');
    setPickShapeIds([]);
    setPickColorIds([]);
    setPickSizeIdxs([]);
    setPickQty('');
    setPickRequestType('Place Order');
    setMessage('');
  }

  async function handleCategoryChange(idStr: string, opts: { keepFamily?: boolean } = {}) {
    const id = idStr ? Number(idStr) : '';
    setPickCategoryId(id);
    setPickShapeIds([]);
    setPickColorIds([]);
    setPickSizeIdxs([]);
    setMessage('');
    if (!opts.keepFamily) setPickFamily(null);
    // The buyer's usual grade for this stone -- from the colour they started
    // with if that points here, else any usual pick for this category.
    const grades = typeof id === 'number' ? categoryGrades(id) : [];
    const fromFamily = opts.keepFamily && pickFamily ? preferenceForFamily(preferences, pickFamily) : null;
    const usual = (fromFamily?.categoryId === id ? fromFamily : null) || preferences.find((p) => p.categoryId === id && p.grade);
    setPickGrade(usual?.grade && grades.includes(usual.grade) ? usual.grade : '');
    if (!id || optionsCache[id]) return;
    const cat = allCategories?.find((c) => c.id === id);
    if (!cat) return;
    setLoadingOptions(true);
    try {
      const res = await fetch(`/api/app/categories/${cat.slug}`);
      const data = await res.json();
      setOptionsCache((cur) => ({ ...cur, [id]: { shapes: data.shapes || [], colors: data.colors || [], sizes: data.sizes || [], photos: data.photos || [], colorChartUrl: data.colorChartUrl, pricing: data.pricing } }));
    } finally {
      setLoadingOptions(false);
    }
  }

  const currentOptions = typeof pickCategoryId === 'number' ? optionsCache[pickCategoryId] : null;
  const currentCategory = typeof pickCategoryId === 'number' ? allCategories?.find((c) => c.id === pickCategoryId) : null;

  // Same rule as the category page's builder -- a shape that shares no size
  // with what's already picked is greyed out where it's picked, not left to
  // be discovered at the size list.
  const incompatibleShapes = useMemo(
    () => incompatibleShapeIds(currentOptions?.shapes || [], currentOptions?.sizes || [], pickShapeIds),
    [currentOptions, pickShapeIds]
  );

  const sizesForShapes = useMemo(() => {
    if (!currentOptions || pickShapeIds.length === 0) return [];
    const bySizeMm = new Map<string, typeof currentOptions.sizes>();
    currentOptions.sizes.forEach((sz) => {
      if (!pickShapeIds.includes(sz.shapeId)) return;
      if (!bySizeMm.has(sz.sizeMm)) bySizeMm.set(sz.sizeMm, []);
      bySizeMm.get(sz.sizeMm)!.push(sz);
    });
    const common: { sizeMm: string; rows: typeof currentOptions.sizes }[] = [];
    bySizeMm.forEach((rows, sizeMm) => {
      const shapeIdsCovered = new Set(rows.map((r) => r.shapeId));
      if (pickShapeIds.every((id) => shapeIdsCovered.has(id))) common.push({ sizeMm, rows });
    });
    return common.sort((a, b) => {
      const na = strictSizeNum(a.sizeMm);
      const nb = strictSizeNum(b.sizeMm);
      if (Number.isNaN(na) && Number.isNaN(nb)) return a.sizeMm.localeCompare(b.sizeMm);
      if (Number.isNaN(na)) return 1;
      if (Number.isNaN(nb)) return -1;
      return na - nb;
    });
  }, [currentOptions, pickShapeIds]);

  const sizeOptions = useMemo(() => sizesForShapes.map((g, i) => ({ id: i, hotIds: g.rows.map((row) => row.id), name: `${g.sizeMm} mm` })), [sizesForShapes]);

  const grades = typeof pickCategoryId === 'number' ? categoryGrades(pickCategoryId) : [];

  // With a colour chosen, only that family's colours are offered -- unless the
  // category has none in it, in which case hiding everything would be a dead end.
  const familyColors = useMemo(
    () => (currentOptions && pickFamily ? currentOptions.colors.filter((c) => colorFamilyId(c.name, c.hex) === pickFamily) : []),
    [currentOptions, pickFamily]
  );
  const colorOptions = pickFamily && familyColors.length > 0 ? familyColors : currentOptions?.colors || [];
  const familyMissing = !!pickFamily && !!currentOptions && familyColors.length === 0;
  useEffect(() => {
    if (familyColors.length === 1 && pickColorIds.length === 0) setPickColorIds([familyColors[0].id]);
  }, [familyColors]); // eslint-disable-line react-hooks/exhaustive-deps

  const qtyNum = parseInt(pickQty, 10) || 0;
  const canAdd = !!currentOptions && pickShapeIds.length > 0 && pickColorIds.length > 0 && pickSizeIdxs.length > 0 && qtyNum > 0
    && (grades.length === 0 || grades.includes(pickGrade));
  const comboCount = pickShapeIds.length * pickColorIds.length * pickSizeIdxs.length;

  function addLines() {
    if (!canAdd || !currentOptions || !currentCategory) {
      setMessage(grades.length > 0 && !pickGrade ? `Choose a quality (${grades.join(' or ')}) first.` : 'Pick a shape, color and size, and enter quantity first.');
      return;
    }
    let cart = loadCart();
    let added = 0;
    for (const shapeId of pickShapeIds) {
      const shape = currentOptions.shapes.find((s) => s.id === shapeId);
      if (!shape) continue;
      for (const colorId of pickColorIds) {
        const color = currentOptions.colors.find((c) => c.id === colorId);
        if (!color) continue;
        for (const sizeIdx of pickSizeIdxs) {
          const group = sizesForShapes[sizeIdx];
          const match = group?.rows.find((r) => r.shapeId === shapeId);
          if (!match) continue;
          const item: CartItem = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            categoryId: currentCategory.id,
            categoryName: currentCategory.name,
            shapeId: shape.id,
            shapeName: shape.name,
            shapeRefPhotoUrl: shape.refPhotoUrl,
            shapeIconKey: shape.iconKey,
            sizeId: match.id,
            sizeMm: match.sizeMm,
            colorId: color.id,
            colorName: color.name,
            colorHex: color.hex || '#ccc',
            colorRefPhotoUrl: color.refPhotoUrl || null,
            qty: qtyNum,
            requestType: pickRequestType,
            ...(grades.length > 0 && pickGrade ? { orderSpecs: gradeSpec(pickGrade) } : {})
          };
          cart = mergeIntoCart(cart, item);
          added++;
        }
      }
    }
    saveCart(cart);
    setCartCount(cartPieces(cart));
    setAddedCount((n) => n + added);
    setMessage(added > 1 ? `Added ${added} lines to your cart.` : 'Added to your cart.');
    setPickSizeIdxs([]);
    setPickQty('');
  }

  function addSpecialLine(line: any) {
    const cart = mergeIntoCart(loadCart(), { ...line, id: line.id || `${Date.now()}-${Math.random().toString(16).slice(2)}` });
    saveCart(cart);
    setCartCount(cartPieces(cart));
    setAddedCount((n) => n + 1);
    setMessage('Added to your cart.');
  }

  return (
    <>
      <button type="button" className="quick-order-btn" onClick={(e) => { opener.current = e.currentTarget; setOpen(true); }}>
        + {label}
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="quick-order-dialog"
          aria-label="Quick order"
          onCancel={(e) => { e.preventDefault(); close(); }}
          onClose={() => { setOpen(false); reset(); opener.current?.focus(); }}
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="quick-order-head">
            <strong>Quick Order</strong>
            <button type="button" autoFocus onClick={close} aria-label="Close quick order">✕</button>
          </div>
          <p className="quick-order-hint">Start with a colour or a category, then shape, size and quantity.</p>

          <div className="qo-family-chips" role="group" aria-label="Start with a colour">
            {COLOR_FAMILIES.map((f) => {
              const usual = preferenceForFamily(preferences, f.id);
              const usualName = usual ? allCategories?.find((c) => c.id === usual.categoryId)?.name : null;
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`qo-family-chip${pickFamily === f.id ? ' active' : ''}`}
                  aria-pressed={pickFamily === f.id}
                  title={usualName ? `${usualName}${usual?.grade ? ` ${usual.grade}` : ''}` : undefined}
                  ref={pickFamily === f.id ? (el) => el?.scrollIntoView({ block: 'nearest', inline: 'center' }) : undefined}
                  onClick={() => chooseFamily(pickFamily === f.id ? null : f.id)}
                >
                  <ColorSwatch hex={f.hex} refPhotoUrl={f.refPhotoUrl} size={22} />
                  {f.name}
                </button>
              );
            })}
          </div>
          {pickFamily && !pickCategoryId && !pendingCategoryId && (
            <p className="quick-order-hint">Now choose the stone.</p>
          )}

          <div className="po-add-form" data-special-category={specialCategory(Number(pickCategoryId)) || undefined}>
            <div>
              <label className="po-label">Category</label>
              <IconSelect
                options={(allCategories || []).map((c) => ({ id: c.id, name: c.name, refPhotoUrl: categoryIconUrl(c.slug) }))}
                value={pickCategoryId === '' ? 'all' : pickCategoryId}
                onChange={(v) => handleCategoryChange(v === 'all' ? '' : String(v))}
                allLabel={loadingCategories ? 'Loading categories…' : 'Choose category'}
                leading="photo"
                searchable
              />
            </div>
            {grades.length > 0 && (
              <div>
                <label className="po-label" id="qo-grade-label">Quality</label>
                <div className="po-type-toggle po-grade-toggle" role="group" aria-labelledby="qo-grade-label">
                  {grades.map((g) => (
                    <button key={g} type="button" aria-pressed={pickGrade === g} className={pickGrade === g ? 'active' : ''} onClick={() => setPickGrade(g)}>{g}</button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="po-label">Color{pickColorIds.length > 1 ? 's' : ''}</label>
              {familyMissing && <p className="quick-order-hint" style={{ margin: '0 0 6px' }}>No {COLOR_FAMILIES.find((f) => f.id === pickFamily)?.name.toLowerCase()} in this stone — showing all colours.</p>}
              {/* Before a stone is chosen the colour is where an order can
                  start: pick a colour family here, same as the buttons above. */}
              {!currentOptions ? (
                <IconSelect
                  options={COLOR_FAMILIES}
                  value={pickFamily ?? 'all'}
                  onChange={(v) => chooseFamily(v === 'all' ? null : v)}
                  allLabel="Choose colour"
                  leading="swatch"
                />
              ) : (
                <IconSelect
                  categoryId={Number(pickCategoryId) || undefined}
                  multiple
                  options={colorOptions}
                  locked={pickCategoryId === 34}
                  values={pickColorIds}
                  onChange={setPickColorIds}
                  placeholder="Choose color(s)"
                  leading="swatch"
                />
              )}
            </div>
            <div>
              <label className="po-label">Shape{pickShapeIds.length > 1 ? 's' : ''}</label>
              <IconSelect
                categoryId={Number(pickCategoryId) || undefined}
                multiple
                options={currentOptions?.shapes || []}
                values={pickShapeIds}
                onChange={(v) => { setPickShapeIds(v); setPickSizeIdxs([]); }}
                placeholder={!currentOptions ? 'Pick a category first' : 'Choose shape(s)'}
                leading="icon"
                disabledIds={incompatibleShapes}
                disabledReason={NO_SHARED_SIZE_REASON}
                disabledNote={NO_SHARED_SIZE_NOTE}
              />
            </div>
            <div>
              <label className="po-label">Size{pickSizeIdxs.length > 1 ? 's' : ''} (mm)</label>
              <IconSelect
                categoryId={Number(pickCategoryId) || undefined}
                multiple
                optionKind="size"
                options={sizeOptions}
                values={pickSizeIdxs}
                onChange={setPickSizeIdxs}
                placeholder={pickShapeIds.length === 0 ? 'Pick a shape first' : sizeOptions.length === 0 ? 'No common size for these shapes' : 'Choose size(s)'}
              />
            </div>
            <div>
              <label className="po-label">Qty (pcs)</label>
              <input
                type="text"
                inputMode="numeric"
                className="po-qty-input"
                placeholder="e.g. 5000"
                value={pickQty}
                onChange={(e) => setPickQty(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>

          {loadingOptions && <p className="quick-order-hint">Loading category options…</p>}

          {currentOptions && currentCategory && (
            <OrderReferenceCarousel
              colorChartUrl={currentOptions.colorChartUrl}
              photos={currentOptions.photos}
              categoryName={currentCategory.name}
              shapeIds={pickShapeIds}
              colorIds={pickColorIds}
              sizeIds={pickSizeIdxs.flatMap((index) => sizesForShapes[index]?.rows.map((row) => row.id) || [])}
              shapes={currentOptions.shapes}
              colors={currentOptions.colors}
            />
          )}

          {specialCategory(Number(pickCategoryId)) && currentOptions && (
            <SpecialOrderComposer
              key={pickCategoryId}
              categoryId={Number(pickCategoryId)}
              categoryName={currentCategory?.name || ''}
              shapes={currentOptions.shapes}
              colors={currentOptions.colors}
              sizes={currentOptions.sizes}
              onAdd={addSpecialLine}
            />
          )}
          <div hidden={!!specialCategory(Number(pickCategoryId))}>
            <div className="po-type-toggle" role="group" aria-label="Request type">
              <button type="button" aria-pressed={pickRequestType === 'Place Order'} className={pickRequestType === 'Place Order' ? 'active' : ''} onClick={() => setPickRequestType('Place Order')}>Purchase</button>
              <button type="button" aria-pressed={pickRequestType === 'Request Quotation'} className={pickRequestType === 'Request Quotation' ? 'active' : ''} onClick={() => setPickRequestType('Request Quotation')}>Request Quotation</button>
            </div>
            <button type="button" className="po-add-line-btn" onClick={addLines} disabled={!canAdd}>
              + Add {comboCount > 1 ? `${comboCount} lines` : 'line'} to cart
            </button>
            {/* Adding keeps the category, shape and colour so the next line is
                quick; this empties the form completely, category included. */}
            {(pickCategoryId !== '' || pickShapeIds.length > 0 || pickColorIds.length > 0 || pickSizeIdxs.length > 0 || pickQty !== '') && (
              <button type="button" className="po-clear-selection" onClick={reset}>Clear selection</button>
            )}
          </div>

          {message && <p className="quick-order-message" aria-live="polite">{message}</p>}

          <div className="quick-order-footer">
            <span>{addedCount > 0 ? `${addedCount} line${addedCount === 1 ? '' : 's'} added this session` : ''}</span>
            <Link href="/po/cart" className="btn-ghost" onClick={close}>Go to cart{cartCount > 0 ? ` (${cartCount})` : ''}</Link>
          </div>
        </dialog>
      )}
    </>
  );
}
