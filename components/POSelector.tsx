'use client';

import { useEffect, useMemo, useState } from 'react';
import IconSelect from './IconSelect';

type ShapeRef = { id: number; name: string; iconKey?: string | null };
type ColorRef = { id: number; name: string; hex?: string | null };
type Size = { id: number; shape_id: number; size_mm: string };

type CartItem = {
  id: string;
  categoryId: number;
  categoryName: string;
  shapeId: number;
  shapeName: string;
  sizeId: number;
  sizeMm: string;
  colorId: number;
  colorName: string;
  colorHex: string;
  qty: number;
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

export default function POSelector({
  categoryId,
  categoryName,
  whatsappNumber,
  shapes,
  colors,
  sizes
}: {
  categoryId: number;
  categoryName: string;
  whatsappNumber?: string;
  shapes: ShapeRef[];
  colors: ColorRef[];
  sizes: Size[];
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [pickShapeId, setPickShapeId] = useState<number | 'all'>('all');
  const [pickColorId, setPickColorId] = useState<number | 'all'>('all');
  const [pickSizeId, setPickSizeId] = useState<number | 'all'>('all');
  const [pickQty, setPickQty] = useState('');
  const [requestType, setRequestType] = useState('Place Order');
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

  const sizesForShape = useMemo(
    () => (pickShapeId === 'all' ? [] : sizes.filter((sz) => sz.shape_id === pickShapeId)),
    [sizes, pickShapeId]
  );

  const qtyNum = parseInt(pickQty, 10) || 0;
  const canAdd = pickShapeId !== 'all' && pickColorId !== 'all' && pickSizeId !== 'all' && qtyNum > 0;

  const totalPieces = cart.reduce((sum, i) => sum + i.qty, 0);

  function addLine() {
    if (!canAdd) {
      setToast('Pick shape, color, size and enter quantity first.');
      return;
    }
    const shape = shapes.find((s) => s.id === pickShapeId)!;
    const color = colors.find((c) => c.id === pickColorId)!;
    const size = sizes.find((s) => s.id === pickSizeId)!;

    const existing = cart.find(
      (i) => i.categoryId === categoryId && i.shapeId === shape.id && i.sizeId === size.id && i.colorId === color.id
    );
    if (existing) {
      setCart(cart.map((i) => (i.id === existing.id ? { ...i, qty: i.qty + qtyNum } : i)));
      setToast(`Updated ${shape.name} ${size.size_mm}mm ${color.name} quantity`);
    } else {
      const item: CartItem = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        categoryId,
        categoryName,
        shapeId: shape.id,
        shapeName: shape.name,
        sizeId: size.id,
        sizeMm: size.size_mm,
        colorId: color.id,
        colorName: color.name,
        colorHex: color.hex || '#ccc',
        qty: qtyNum
      };
      setCart([...cart, item]);
      setToast(`Added ${shape.name} ${size.size_mm}mm ${color.name}`);
    }
    // Reset only size + qty so the same shape/color can be reused for the next size quickly
    setPickSizeId('all');
    setPickQty('');
  }

  function updateQty(id: string, qty: number) {
    setCart(cart.map((i) => (i.id === id ? { ...i, qty: Math.max(1, qty) } : i)));
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
        body: JSON.stringify({ cart, requestType, contactName, contactPhone, comment })
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
            <label className="po-label">Shape</label>
            <IconSelect
              options={shapes}
              value={pickShapeId}
              onChange={(v) => { setPickShapeId(v); setPickSizeId('all'); }}
              allLabel="Choose shape"
              leading="icon"
            />
          </div>
          <div>
            <label className="po-label">Color</label>
            <IconSelect options={colors} value={pickColorId} onChange={setPickColorId} allLabel="Choose color" leading="swatch" />
          </div>
          <div>
            <label className="po-label">Size (mm)</label>
            <select
              value={pickSizeId}
              onChange={(e) => setPickSizeId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              disabled={pickShapeId === 'all'}
            >
              <option value="all">{pickShapeId === 'all' ? 'Pick a shape first' : 'Choose size'}</option>
              {sizesForShape.map((sz) => <option key={sz.id} value={sz.id}>{sz.size_mm} mm</option>)}
            </select>
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
        <button type="button" className="po-add-line-btn" onClick={addLine} disabled={!canAdd}>
          + Add line to order
        </button>
      </section>

      <section className="po-card po-cart-card">
        <div className="po-cart-head">
          <h2 className="po-heading">Your Requirement</h2>
          <span className="po-cart-badge">{cart.length} {cart.length === 1 ? 'line' : 'lines'} · {totalPieces.toLocaleString('en-IN')} pcs</span>
        </div>

        {cart.length === 0 ? (
          <div className="po-empty po-empty-cart">No lines added yet. Fill the form above and tap "Add line to order" -- repeat for each shape/color/size combo.</div>
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
              Request type
              <select value={requestType} onChange={(e) => setRequestType(e.target.value)}>
                <option>Place Order</option>
                <option>Request Quotation</option>
              </select>
            </label>
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
