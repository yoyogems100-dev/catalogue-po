'use client';

import { useEffect, useMemo, useState } from 'react';
import IconSelect from '@/components/IconSelect';

type RequestType = 'Place Order' | 'Request Quotation';

type ComboSuggestion = {
  categoryId: number;
  categoryName: string;
  shapeId: number;
  shapeName: string;
  sizeId: number | null;
  sizeMm: string;
  colorId: number;
  colorName: string;
  colorHex: string;
  quantity: number;
  requestType: RequestType;
};

type PastOrder = {
  id: number;
  statusLabel: string;
  createdAt: string;
  categoryNames: string[];
  totalPieces: number;
  items: ComboSuggestion[];
};

type CategoryOption = { id: number; name: string; slug: string };

type CategoryOptionsData = {
  shapes: { id: number; name: string; iconKey?: string | null }[];
  colors: { id: number; name: string; hex?: string | null }[];
  sizes: { id: number; shapeId: number; sizeMm: string }[];
};

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
  qty: number;
  requestType: RequestType;
};

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

function strictSizeNum(s: string): number {
  return /^\d+(\.\d+)?$/.test(s.trim()) ? parseFloat(s) : NaN;
}

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

function newCartId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function QuickOrderClient({
  frequentCombos,
  pastOrders,
  categories,
  whatsappNumber
}: {
  frequentCombos: ComboSuggestion[];
  pastOrders: PastOrder[];
  categories: CategoryOption[];
  whatsappNumber?: string;
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
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

  // ---------- Section A: Your Usual ----------
  function addSuggestion(s: ComboSuggestion) {
    setCart((cur) =>
      mergeIntoCart(cur, {
        id: newCartId(),
        categoryId: s.categoryId,
        categoryName: s.categoryName,
        shapeId: s.shapeId,
        shapeName: s.shapeName,
        sizeId: s.sizeId,
        sizeMm: s.sizeMm,
        colorId: s.colorId,
        colorName: s.colorName,
        colorHex: s.colorHex,
        qty: s.quantity,
        requestType: s.requestType
      })
    );
  }

  function addAllUsual() {
    let next = cart;
    frequentCombos.forEach((s) => {
      next = mergeIntoCart(next, {
        id: newCartId(),
        categoryId: s.categoryId,
        categoryName: s.categoryName,
        shapeId: s.shapeId,
        shapeName: s.shapeName,
        sizeId: s.sizeId,
        sizeMm: s.sizeMm,
        colorId: s.colorId,
        colorName: s.colorName,
        colorHex: s.colorHex,
        qty: s.quantity,
        requestType: s.requestType
      });
    });
    setCart(next);
    setToast(`Added ${frequentCombos.length} of your usual lines`);
  }

  // ---------- Section B: repeat a past order ----------
  function repeatOrder(orderId: number) {
    const order = pastOrders.find((o) => o.id === orderId);
    if (!order || order.items.length === 0) return;
    let next = cart;
    order.items.forEach((it) => {
      next = mergeIntoCart(next, {
        id: newCartId(),
        categoryId: it.categoryId,
        categoryName: it.categoryName,
        shapeId: it.shapeId,
        shapeName: it.shapeName,
        sizeId: it.sizeId,
        sizeMm: it.sizeMm,
        colorId: it.colorId,
        colorName: it.colorName,
        colorHex: it.colorHex,
        qty: it.quantity,
        requestType: it.requestType
      });
    });
    setCart(next);
    setToast(`Added ${order.items.length} line${order.items.length > 1 ? 's' : ''} from order #${orderId}`);
  }

  // ---------- Section C: build a new order, category-first ----------
  const [pickCategoryId, setPickCategoryId] = useState<number | ''>('');
  const [optionsCache, setOptionsCache] = useState<Record<number, CategoryOptionsData>>({});
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [pickShapeIds, setPickShapeIds] = useState<number[]>([]);
  const [pickColorIds, setPickColorIds] = useState<number[]>([]);
  const [pickSizeIdxs, setPickSizeIdxs] = useState<number[]>([]);
  const [rangeMin, setRangeMin] = useState('');
  const [rangeMax, setRangeMax] = useState('');
  const [pickQty, setPickQty] = useState('');
  const [pickRequestType, setPickRequestType] = useState<RequestType>('Place Order');

  async function handleCategoryChange(idStr: string) {
    const id = idStr ? Number(idStr) : '';
    setPickCategoryId(id);
    setPickShapeIds([]);
    setPickColorIds([]);
    setPickSizeIdxs([]);
    if (!id || optionsCache[id]) return;
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    setLoadingOptions(true);
    try {
      const res = await fetch(`/api/app/categories/${cat.slug}`);
      const data = await res.json();
      setOptionsCache((cur) => ({
        ...cur,
        [id]: { shapes: data.shapes || [], colors: data.colors || [], sizes: data.sizes || [] }
      }));
    } finally {
      setLoadingOptions(false);
    }
  }

  const currentOptions = typeof pickCategoryId === 'number' ? optionsCache[pickCategoryId] : null;
  const currentCategory = typeof pickCategoryId === 'number' ? categories.find((c) => c.id === pickCategoryId) : null;

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

  const sizeOptions = useMemo(() => sizesForShapes.map((g, i) => ({ id: i, name: `${g.sizeMm} mm` })), [sizesForShapes]);

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
  const canAddBuilt =
    !!currentOptions && pickShapeIds.length > 0 && pickColorIds.length > 0 && pickSizeIdxs.length > 0 && qtyNum > 0;
  const builtComboCount = pickShapeIds.length * pickColorIds.length * pickSizeIdxs.length;

  function addBuiltLines() {
    if (!canAddBuilt || !currentOptions || !currentCategory) {
      setToast('Pick a category, shape, color and size, and enter quantity first.');
      return;
    }
    let next = cart;
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
          next = mergeIntoCart(next, {
            id: newCartId(),
            categoryId: currentCategory.id,
            categoryName: currentCategory.name,
            shapeId: shape.id,
            shapeName: shape.name,
            sizeId: match.id,
            sizeMm: match.sizeMm,
            colorId: color.id,
            colorName: color.name,
            colorHex: color.hex || '#ccc',
            qty: qtyNum,
            requestType: pickRequestType
          });
          added++;
        }
      }
    }
    setCart(next);
    setToast(added > 1 ? `Added ${added} lines to your order` : 'Added to your order');
    setPickSizeIdxs([]);
    setPickQty('');
  }

  // ---------- Cart list ----------
  function updateQty(id: string, qty: number) {
    setCart(cart.map((i) => (i.id === id ? { ...i, qty: Math.max(1, qty) } : i)));
  }
  function updateItemRequestType(id: string, requestType: RequestType) {
    setCart(cart.map((i) => (i.id === id ? { ...i, requestType } : i)));
  }
  function removeItem(id: string) {
    setCart(cart.filter((i) => i.id !== id));
  }
  const totalPieces = cart.reduce((sum, i) => sum + i.qty, 0);

  // ---------- Send ----------
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

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
      {frequentCombos.length > 0 && (
        <section className="po-card">
          <h2 className="po-heading">Your Usual</h2>
          <p style={{ fontSize: 12, color: '#8a8370', marginBottom: 10 }}>
            Your most frequently ordered combinations -- add them all at once, or pick individually.
          </p>
          <div className="qo-suggestion-list">
            {frequentCombos.map((s, i) => (
              <button type="button" key={i} className="qo-suggestion-chip" onClick={() => addSuggestion(s)}>
                <i className="po-size-color-dot" style={{ background: s.colorHex }} />
                {s.shapeName} · {s.sizeMm}mm · {s.colorName}
                <span className="qo-suggestion-qty">{s.quantity.toLocaleString('en-IN')} pcs</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn" style={{ marginTop: 10 }} onClick={addAllUsual}>
            + Add all {frequentCombos.length} to cart
          </button>
        </section>
      )}

      {pastOrders.length > 0 && (
        <section className="po-card">
          <h2 className="po-heading">Repeat a Past Order</h2>
          <div className="qo-past-order-list">
            {pastOrders.slice(0, 8).map((o) => (
              <div key={o.id} className="qo-past-order-row">
                <div>
                  <strong>Order #{o.id}</strong>
                  <span>
                    {new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} ·{' '}
                    {o.categoryNames.join(', ')} · {o.totalPieces.toLocaleString('en-IN')} pcs
                  </span>
                </div>
                <button type="button" className="btn-ghost" onClick={() => repeatOrder(o.id)}>Repeat</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="po-card">
        <h2 className="po-heading">Build a New Order</h2>
        <div className="po-add-form">
          <div>
            <label className="po-label">Category</label>
            <select value={pickCategoryId} onChange={(e) => handleCategoryChange(e.target.value)}>
              <option value="">Choose category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="po-label">Shape{pickShapeIds.length > 1 ? 's' : ''}</label>
            <IconSelect
              multiple
              options={currentOptions?.shapes || []}
              values={pickShapeIds}
              onChange={(v) => { setPickShapeIds(v); setPickSizeIdxs([]); }}
              placeholder={!currentOptions ? 'Pick a category first' : 'Choose shape(s)'}
              leading="icon"
            />
          </div>
          <div>
            <label className="po-label">Color{pickColorIds.length > 1 ? 's' : ''}</label>
            <IconSelect
              multiple
              options={currentOptions?.colors || []}
              values={pickColorIds}
              onChange={setPickColorIds}
              placeholder={!currentOptions ? 'Pick a category first' : 'Choose color(s)'}
              leading="swatch"
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
                pickShapeIds.length === 0 ? 'Pick a shape first' : sizeOptions.length === 0 ? 'No common size for these shapes' : 'Choose size(s)'
              }
            />
            {pickShapeIds.length > 0 && (
              <div className="po-range-row">
                <input type="text" inputMode="decimal" placeholder="Min mm" value={rangeMin} onChange={(e) => setRangeMin(e.target.value)} />
                <span>to</span>
                <input type="text" inputMode="decimal" placeholder="Max mm" value={rangeMax} onChange={(e) => setRangeMax(e.target.value)} />
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

        {loadingOptions && <p style={{ fontSize: 12, color: '#8a8370' }}>Loading category options...</p>}

        <div className="po-type-toggle">
          <button type="button" className={pickRequestType === 'Place Order' ? 'active' : ''} onClick={() => setPickRequestType('Place Order')}>
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

        <button type="button" className="po-add-line-btn" onClick={addBuiltLines} disabled={!canAddBuilt}>
          + Add {builtComboCount > 1 ? `${builtComboCount} lines` : 'line'} to order
        </button>
      </section>

      <section className="po-card po-cart-card">
        <div className="po-cart-head">
          <h2 className="po-heading">Your Requirement</h2>
          <span className="po-cart-badge">{cart.length} {cart.length === 1 ? 'line' : 'lines'} · {totalPieces.toLocaleString('en-IN')} pcs</span>
        </div>

        {cart.length === 0 ? (
          <div className="po-empty po-empty-cart">
            No lines added yet. Add your usual, repeat a past order, or build a new one above.
          </div>
        ) : (
          <div className="po-item-list">
            {cart.map((item) => (
              <div key={item.id} className="po-item-row">
                <div className="po-item-main">
                  <strong>{item.shapeName} · {item.sizeMm}mm</strong>
                  <span>
                    {item.categoryName}
                    <i className="po-size-color-dot" style={{ background: item.colorHex }} />
                    {item.colorName}
                  </span>
                </div>
                <select className="po-item-type-select" value={item.requestType} onChange={(e) => updateItemRequestType(item.id, e.target.value as RequestType)}>
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
            ))}
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
