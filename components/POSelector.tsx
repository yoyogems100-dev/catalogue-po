'use client';

import { useEffect, useMemo, useState } from 'react';
import IconSelect from './IconSelect';
import ColorSwatch from './ColorSwatch';
import type { CategoryPricing } from '@/lib/pricing-calc';
import { lineInrPrice } from '@/lib/pricing-calc';

type ShapeRef = { id: number; name: string; iconKey?: string | null };
type ColorRef = { id: number; name: string; hex?: string | null; refPhotoUrl?: string | null };
type Size = { id: number; shape_id: number; size_mm: string };

type RequestType = 'Place Order' | 'Request Quotation';

type CartItem = {
  id: string;
  categoryId: number;
  categoryName: string;
  shapeId: number;
  shapeName: string;
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
  pricing
}: {
  categoryId: number;
  categoryName: string;
  whatsappNumber?: string;
  shapes: ShapeRef[];
  colors: ColorRef[];
  sizes: Size[];
  colorPalettes?: ColorPalette[];
  pricing?: CategoryPricing;
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
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
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    setCart(loadCart());
    setHydrated(true);
  }, []);

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

  const sizeOptions = useMemo(
    () => sizesForShapes.map((g, i) => ({ id: i, name: `${g.sizeMm} mm` })),
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

  const qtyNum = parseInt(pickQty, 10) || 0;
  const canAdd = pickShapeIds.length > 0 && pickColorIds.length > 0 && pickSizeIdxs.length > 0 && qtyNum > 0;
  const comboCount = pickShapeIds.length * pickColorIds.length * pickSizeIdxs.length;

  const totalPieces = cart.reduce((sum, i) => sum + i.qty, 0);

  // Unit price is looked up live from the pricing prop, not stored on the cart
  // item -- so it always reflects the current admin-set price/multiplier, and
  // categories with no pricing set up yet just show nothing (no crash).
  function unitPriceInr(item: CartItem): number | null {
    if (!pricing || item.sizeId == null) return null;
    return lineInrPrice(pricing, item.shapeId, item.sizeId, item.colorId);
  }
  const cartTotalInr = cart.reduce((sum, item) => {
    const unit = unitPriceInr(item);
    return unit === null ? sum : sum + unit * item.qty;
  }, 0);
  const hasAnyPricedLine = cart.some((item) => unitPriceInr(item) !== null);

  function mergeIntoCart(current: CartItem[], item: CartItem): CartItem[] {
    const existing = current.find(
      (i) =>
        i.categoryId === item.categoryId &&
        i.shapeId === item.shapeId &&
        i.colorId === item.colorId &&
        i.sizeId === item.sizeId &&
        i.requestType === item.requestType
    );
    if (existing) {
      return current.map((i) => (i.id === existing.id ? { ...i, qty: i.qty + item.qty } : i));
    }
    return [...current, item];
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

    setCart(next);
    setToast(added > 1 ? `Added ${added} lines to your order` : 'Added to your order');
    // Reset only size + qty so the same shape/color picks can be reused for the next size quickly
    setPickSizeIdxs([]);
    setPickQty('');
  }

  function updateQty(id: string, qty: number) {
    setCart(cart.map((i) => (i.id === id ? { ...i, qty: Math.max(1, qty) } : i)));
  }

  function updateItemRequestType(id: string, requestType: RequestType) {
    setCart(cart.map((i) => (i.id === id ? { ...i, requestType } : i)));
  }

  function removeItem(id: string) {
    setCart(cart.filter((i) => i.id !== id));
  }

  async function sendRequirement() {
    if (cart.length === 0) {
      setToast('Add at least one line to your order first.');
      return;
    }
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
      window.open(url, '_blank', 'noopener,noreferrer');

      setCart([]);
      setComment('');
      setToast('Requirement sent! Opening WhatsApp...');
    } catch (err: any) {
      setToast(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="po-wrap">
      <section className="po-card">
        <h2 className="po-heading">Add to Order</h2>
        <div className="po-add-form">
          <div>
            <label className="po-label">Color{pickColorIds.length > 1 ? 's' : ''}</label>
            <IconSelect
              multiple
              options={colors}
              values={pickColorIds}
              onChange={setPickColorIds}
              placeholder="Choose color(s)"
              leading="swatch"
              palettes={colorPalettes}
            />
          </div>
          <div>
            <label className="po-label">Shape{pickShapeIds.length > 1 ? 's' : ''}</label>
            <IconSelect
              multiple
              options={shapes}
              values={pickShapeIds}
              onChange={(v) => { setPickShapeIds(v); setPickSizeIdxs([]); }}
              placeholder="Choose shape(s)"
              leading="icon"
            />
          </div>
          <div>
            <label className="po-label">Size{pickSizeIdxs.length > 1 ? 's' : ''} (mm)</label>
            <IconSelect
              multiple
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
                  placeholder="Min mm"
                  value={rangeMin}
                  onChange={(e) => setRangeMin(e.target.value)}
                />
                <span>to</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Max mm"
                  value={rangeMax}
                  onChange={(e) => setRangeMax(e.target.value)}
                />
                <button type="button" className="po-inline-link" onClick={applyRange}>Select range</button>
              </div>
            )}
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

        <div className="po-type-toggle">
          <button
            type="button"
            className={pickRequestType === 'Place Order' ? 'active' : ''}
            onClick={() => setPickRequestType('Place Order')}
          >
            Place Order
          </button>
          <button
            type="button"
            className={pickRequestType === 'Request Quotation' ? 'active' : ''}
            onClick={() => setPickRequestType('Request Quotation')}
          >
            Request Quotation
          </button>
        </div>

        <button type="button" className="po-add-line-btn" onClick={addLine} disabled={!canAdd}>
          + Add {comboCount > 1 ? `${comboCount} lines` : 'line'} to order
        </button>
      </section>

      <section className="po-card po-cart-card">
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
          <div className="po-empty po-empty-cart">No lines added yet. Fill the form above and tap "Add line to order" -- pick multiple shapes/colors/sizes at once (or use the size range) to add several lines in one go.</div>
        ) : (
          <div className="po-item-list">
            {cart.map((item) => {
              const unit = unitPriceInr(item);
              return (
              <div key={item.id} className="po-item-row">
                <div className="po-item-main">
                  <strong>{item.shapeName} · {item.sizeMm}mm</strong>
                  <span>
                    {item.categoryName}
                    <ColorSwatch hex={item.colorHex} refPhotoUrl={item.colorRefPhotoUrl} name={item.colorName} size={13} />
                    {item.colorName}
                  </span>
                  {unit !== null && (
                    <span className="mono po-item-price">&#8377;{unit.toFixed(2)} &times; {item.qty} = &#8377;{(unit * item.qty).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  )}
                </div>
                <select
                  className="po-item-type-select"
                  value={item.requestType}
                  onChange={(e) => updateItemRequestType(item.id, e.target.value as RequestType)}
                >
                  <option>Place Order</option>
                  <option>Request Quotation</option>
                </select>
                <input
                  type="text"
                  inputMode="numeric"
                  className="po-qty-input po-cart-qty"
                  value={item.qty}
                  onChange={(e) => updateQty(item.id, parseInt(e.target.value.replace(/\D/g, ''), 10) || 1)}
                />
                <button type="button" className="po-remove-btn" onClick={() => removeItem(item.id)}>&times;</button>
              </div>
              );
            })}
          </div>
        )}
        {hasAnyPricedLine && (
          <div className="po-cart-total mono">
            Estimated total: &#8377;{cartTotalInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        )}

        <div className="po-send-box">
          <div className="po-send-row">
            <label>
              Name / company
              <input type="text" placeholder="Optional" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </label>
          </div>
          <label className="po-block-label">
            Your WhatsApp number <span className="po-optional">(optional -- to track this order later)</span>
            <input type="tel" placeholder="e.g. 9XXXXXXXXX" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </label>
          <label className="po-block-label">
            Additional comment
            <textarea rows={3} placeholder="Message" value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          <button type="button" className="po-send-btn" onClick={sendRequirement} disabled={sending}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.55-3.7 8.21-8.25 8.21Zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.4-.12-.56.13-.17.25-.65.81-.79.97-.15.17-.29.19-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.7-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.44.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.36-.77-1.86-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.87.86-.87 2.09 0 1.23.9 2.42 1.02 2.59.12.17 1.77 2.7 4.28 3.79.6.26 1.06.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.23-.16-.48-.28Z" /></svg>
            {sending ? 'Sending...' : 'Send Requirement'}
          </button>
        </div>
      </section>

      {toast && <div className="po-toast">{toast}</div>}
    </div>
  );
}
