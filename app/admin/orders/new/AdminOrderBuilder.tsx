'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CategoryPricing } from '@/lib/pricing-calc';
import { lineInrPrice } from '@/lib/pricing-calc';
import { maskPhone } from '@/lib/mask';

type Category = { id: number; num: number; name: string };
type Customer = { id: number; name: string | null; phone: string | null; company: string | null };
type Options = {
  shapes: { id: number; name: string }[];
  colors: { id: number; name: string; hex: string | null }[];
  sizes: { id: number; shapeId: number; sizeMm: string }[];
  pricing?: CategoryPricing;
};
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
  qty: number;
};

export default function AdminOrderBuilder({ allCategories, allCustomers }: { allCategories: Category[]; allCustomers: Customer[] }) {
  const router = useRouter();

  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const [pickCategoryId, setPickCategoryId] = useState<number | 'all'>('all');
  const [optionsCache, setOptionsCache] = useState<Record<number, Options>>({});
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [pickShapeId, setPickShapeId] = useState<number | 'all'>('all');
  const [pickSizeId, setPickSizeId] = useState<number | 'all'>('all');
  const [pickColorId, setPickColorId] = useState<number | 'all'>('all');
  const [pickQty, setPickQty] = useState('');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [requestType, setRequestType] = useState('Place Order');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  // UI/UX audit ("Make customer lookup search-first instead of immediately
  // exposing the entire customer list"): an empty query now shows nothing
  // rather than the first 20 customers by default.
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return [];
    return allCustomers.filter((c) => (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q)).slice(0, 20);
  }, [allCustomers, customerSearch]);

  const selectedCustomer = allCustomers.find((c) => c.id === selectedCustomerId) || null;
  const currentOptions = pickCategoryId !== 'all' ? optionsCache[pickCategoryId] : null;
  const sizesForShape = currentOptions && pickShapeId !== 'all' ? currentOptions.sizes.filter((s) => s.shapeId === pickShapeId) : [];

  async function handleCategoryChange(categoryId: number | 'all') {
    setPickCategoryId(categoryId);
    setPickShapeId('all');
    setPickSizeId('all');
    setPickColorId('all');
    if (categoryId === 'all' || optionsCache[categoryId]) return;
    setLoadingOptions(true);
    const res = await fetch(`/api/admin/categories/${categoryId}/options`);
    const data = await res.json().catch(() => null);
    setLoadingOptions(false);
    if (data) setOptionsCache((prev) => ({ ...prev, [categoryId]: data }));
  }

  const qtyNum = parseInt(pickQty, 10) || 0;
  const canAdd = pickCategoryId !== 'all' && pickShapeId !== 'all' && pickSizeId !== 'all' && pickColorId !== 'all' && qtyNum > 0;

  function addLine() {
    if (!canAdd || !currentOptions) return;
    const category = allCategories.find((c) => c.id === pickCategoryId)!;
    const shape = currentOptions.shapes.find((s) => s.id === pickShapeId)!;
    const size = currentOptions.sizes.find((s) => s.id === pickSizeId)!;
    const color = currentOptions.colors.find((c) => c.id === pickColorId)!;

    setCart([
      ...cart,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        categoryId: category.id,
        categoryName: category.name,
        shapeId: shape.id,
        shapeName: shape.name,
        sizeId: size.id,
        sizeMm: size.sizeMm,
        colorId: color.id,
        colorName: color.name,
        qty: qtyNum
      }
    ]);
    setPickSizeId('all');
    setPickQty('');
  }

  function removeLine(id: string) {
    setCart(cart.filter((i) => i.id !== id));
  }

  // Looked up live from whichever category's options are cached, same as the
  // customer-facing builder -- not stored on the cart item itself.
  function unitPriceInr(item: CartItem): number | null {
    const pricing = optionsCache[item.categoryId]?.pricing;
    if (!pricing) return null;
    return lineInrPrice(pricing, item.shapeId, item.sizeId, item.colorId);
  }
  const cartTotalInr = cart.reduce((sum, item) => {
    const unit = unitPriceInr(item);
    return unit === null ? sum : sum + unit * item.qty;
  }, 0);
  const hasAnyPricedLine = cart.some((item) => unitPriceInr(item) !== null);

  async function submit() {
    setToast('');
    if (cart.length === 0) {
      setToast('Add at least one line to the order first.');
      return;
    }
    if (customerMode === 'existing' && !selectedCustomerId) {
      setToast('Pick an existing customer, or switch to "New customer".');
      return;
    }
    if (customerMode === 'new' && !newPhone.trim()) {
      setToast('Enter a phone number for the new customer.');
      return;
    }

    setSubmitting(true);
    const res = await fetch('/api/admin/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: customerMode === 'existing' ? selectedCustomerId : null,
        newCustomerPhone: customerMode === 'new' ? newPhone : null,
        newCustomerName: customerMode === 'new' ? newName : null,
        requestType,
        comment,
        cart: cart.map((i) => ({
          categoryId: i.categoryId,
          categoryName: i.categoryName,
          shapeId: i.shapeId,
          shapeName: i.shapeName,
          sizeId: i.sizeId,
          sizeMm: i.sizeMm,
          colorId: i.colorId,
          colorName: i.colorName,
          qty: i.qty
        }))
      })
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (res.ok) {
      router.push(`/admin/orders/${data.orderId}`);
    } else {
      setToast(data.error || 'Failed to create order.');
    }
  }

  return (
    <div className="po-wrap">
      <section className="po-card">
        <h2 className="po-heading">Customer</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button
            type="button"
            className="btn-ghost"
            style={customerMode === 'existing' ? { background: 'var(--navy)', color: '#fff', borderColor: 'var(--navy)' } : undefined}
            onClick={() => setCustomerMode('existing')}
          >
            Existing customer
          </button>
          <button
            type="button"
            className="btn-ghost"
            style={customerMode === 'new' ? { background: 'var(--navy)', color: '#fff', borderColor: 'var(--navy)' } : undefined}
            onClick={() => setCustomerMode('new')}
          >
            New customer
          </button>
        </div>

        {customerMode === 'existing' ? (
          <div>
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomerId(null); }}
              style={{ marginBottom: 8 }}
            />
            {selectedCustomer ? (
              <div className="tag-chip active" style={{ fontSize: 13 }}>
                {selectedCustomer.name || 'No name'} · {maskPhone(selectedCustomer.phone)}
                <button
                  type="button"
                  aria-label="Clear selected customer"
                  style={{ cursor: 'pointer', marginLeft: 8, background: 'none', border: 'none', color: 'inherit', font: 'inherit' }}
                  onClick={() => setSelectedCustomerId(null)}
                >
                  &times;
                </button>
              </div>
            ) : (
              <div role="listbox" aria-label="Matching customers" style={{ maxHeight: 180, overflowY: 'auto', border: customerSearch.trim() ? '1px solid var(--line)' : 'none' }}>
                {!customerSearch.trim() && (
                  <div style={{ padding: 10, fontSize: 12.5, color: '#8a8370' }}>Start typing a name or phone number to find a customer.</div>
                )}
                {customerSearch.trim() && filteredCustomers.length === 0 && (
                  <div style={{ padding: 10, fontSize: 12.5, color: '#8a8370' }}>No matching customers.</div>
                )}
                {filteredCustomers.map((c) => (
                  <div
                    key={c.id}
                    role="option"
                    aria-selected={false}
                    tabIndex={0}
                    onClick={() => setSelectedCustomerId(c.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCustomerId(c.id); } }}
                    style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid var(--line)' }}
                  >
                    {c.name || 'No name'} · {maskPhone(c.phone)}{c.company ? ` · ${c.company}` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, maxWidth: 480 }}>
            <input type="text" placeholder="Name (optional)" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <input type="tel" placeholder="Phone number" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          </div>
        )}
      </section>

      <section className="po-card">
        <h2 className="po-heading">Add to Order</h2>
        <div className="po-add-form">
          <div>
            <label className="po-label">Category</label>
            <select value={pickCategoryId} onChange={(e) => handleCategoryChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
              <option value="all">Choose category</option>
              {allCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="po-label">Shape</label>
            <select value={pickShapeId} onChange={(e) => { setPickShapeId(e.target.value === 'all' ? 'all' : Number(e.target.value)); setPickSizeId('all'); }} disabled={!currentOptions}>
              <option value="all">{loadingOptions ? 'Loading…' : 'Choose shape'}</option>
              {currentOptions?.shapes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="po-label">Color</label>
            <select value={pickColorId} onChange={(e) => setPickColorId(e.target.value === 'all' ? 'all' : Number(e.target.value))} disabled={!currentOptions}>
              <option value="all">Choose color</option>
              {currentOptions?.colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="po-label">Size (mm)</label>
            <select value={pickSizeId} onChange={(e) => setPickSizeId(e.target.value === 'all' ? 'all' : Number(e.target.value))} disabled={pickShapeId === 'all'}>
              <option value="all">{pickShapeId === 'all' ? 'Pick a shape first' : 'Choose size'}</option>
              {sizesForShape.map((s) => <option key={s.id} value={s.id}>{s.sizeMm} mm</option>)}
            </select>
          </div>
          <div>
            <label className="po-label">Qty (pcs)</label>
            <input type="text" inputMode="numeric" className="po-qty-input" placeholder="e.g. 5000" value={pickQty} onChange={(e) => setPickQty(e.target.value.replace(/\D/g, ''))} />
          </div>
        </div>
        <button type="button" className="po-add-line-btn" onClick={addLine} disabled={!canAdd}>+ Add line to order</button>
      </section>

      <section className="po-card po-cart-card">
        <div className="po-cart-head">
          <h2 className="po-heading">Order Lines</h2>
          <span className="po-cart-badge">{cart.length} {cart.length === 1 ? 'line' : 'lines'}</span>
        </div>

        {cart.length === 0 ? (
          <div className="po-empty po-empty-cart">No lines added yet.</div>
        ) : (
          <div className="po-item-list">
            {cart.map((item) => {
              const unit = unitPriceInr(item);
              return (
                <div key={item.id} className="po-item-row">
                  <div className="po-item-main">
                    <strong>{item.shapeName} · {item.sizeMm}mm</strong>
                    <span>{item.categoryName} · {item.colorName} · {item.qty} pcs</span>
                    {unit !== null && (
                      <span className="mono po-item-price">&#8377;{unit.toFixed(2)} &times; {item.qty} = &#8377;{(unit * item.qty).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    )}
                  </div>
                  <button type="button" className="po-remove-btn" onClick={() => removeLine(item.id)}>&times;</button>
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
              Request type
              <select value={requestType} onChange={(e) => setRequestType(e.target.value)}>
                <option value="Place Order">Purchase</option>
                <option value="Request Quotation">Request Quotation</option>
              </select>
            </label>
          </div>
          <label className="po-block-label">
            Note
            <textarea rows={2} placeholder="e.g. Taken over phone call" value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          <button type="button" className="po-send-btn" onClick={submit} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create order'}
          </button>
        </div>

        {toast && <p style={{ fontSize: 12.5, color: '#a3341f', marginTop: 10 }}>{toast}</p>}
      </section>
    </div>
  );
}
