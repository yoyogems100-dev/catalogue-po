'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import IconSelect from './IconSelect';
import SpecialOrderComposer from './SpecialOrderComposer';
import OrderReferenceCarousel from './OrderReferenceCarousel';
import type { OrderReferencePhoto } from '@/lib/order-reference-photos';
import { specialCategory, specText, quantityFactor } from '@/lib/order-specs';
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
export default function QuickOrderButton({ label = 'Quick Order' }: { label?: string }) {
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
    setPickCategoryId('');
    setPickShapeIds([]);
    setPickColorIds([]);
    setPickSizeIdxs([]);
    setPickQty('');
    setPickRequestType('Place Order');
    setMessage('');
  }

  async function handleCategoryChange(idStr: string) {
    const id = idStr ? Number(idStr) : '';
    setPickCategoryId(id);
    setPickShapeIds([]);
    setPickColorIds([]);
    setPickSizeIdxs([]);
    setMessage('');
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

  const qtyNum = parseInt(pickQty, 10) || 0;
  const canAdd = !!currentOptions && pickShapeIds.length > 0 && pickColorIds.length > 0 && pickSizeIdxs.length > 0 && qtyNum > 0;
  const comboCount = pickShapeIds.length * pickColorIds.length * pickSizeIdxs.length;

  function addLines() {
    if (!canAdd || !currentOptions || !currentCategory) {
      setMessage('Pick a shape, color and size, and enter quantity first.');
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
            requestType: pickRequestType
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
          <p className="quick-order-hint">Pick a category, then shape, color, size and quantity to add straight to your cart.</p>

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
            <div>
              <label className="po-label">Color{pickColorIds.length > 1 ? 's' : ''}</label>
              <IconSelect
                categoryId={Number(pickCategoryId) || undefined}
                multiple
                options={currentOptions?.colors || []}
                locked={pickCategoryId === 34}
                values={pickColorIds}
                onChange={setPickColorIds}
                placeholder={!currentOptions ? 'Pick a category first' : 'Choose color(s)'}
                leading="swatch"
              />
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
          </div>

          {message && <p className="quick-order-message" aria-live="polite">{message}</p>}

          <div className="quick-order-footer">
            <span>{addedCount > 0 ? `${addedCount} line${addedCount === 1 ? '' : 's'} added this session` : ''}</span>
            <Link href="/cart" className="btn-ghost" onClick={close}>Go to cart{cartCount > 0 ? ` (${cartCount})` : ''}</Link>
          </div>
        </dialog>
      )}
    </>
  );
}
