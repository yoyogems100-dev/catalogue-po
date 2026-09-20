'use client';
import SpecialOrderComposer from '@/components/SpecialOrderComposer';
import {specialCategory,specKey,specText,type OrderSpecs} from '@/lib/order-specs';

import IconSelect from '@/components/IconSelect';
import { incompatibleShapeIds, NO_SHARED_SIZE_NOTE, NO_SHARED_SIZE_REASON } from '@/lib/shape-size-compat';
import { categoryIconUrl } from '@/lib/category-icons';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CategoryPricing } from '@/lib/pricing-calc';
import { lineInrPrice } from '@/lib/pricing-calc';
import { maskPhone } from '@/lib/mask';

type Category = { id: number; num: number; name: string; slug: string | null };
type Customer = { id: number; name: string | null; phone: string | null; company: string | null };
type Options = {
  shapes: { id: number; name: string; iconKey?: string | null; refPhotoUrl?: string | null }[];
  colors: { id: number; name: string; hex: string | null; refPhotoUrl?: string | null }[];
  sizes: { id: number; shapeId: number; sizeMm: string }[];
  pricing?: CategoryPricing;
};

// Matches a plain "1" / "1.5", or a compound "AxB"/"A*B" -- same rule as the
// customer-facing pickers, so a mixed size list sorts identically everywhere.
function strictSizeNum(s: string): number {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*(?:[xX*]\s*\d+(?:\.\d+)?)?$/);
  return m ? parseFloat(m[1]) : NaN;
}
type CartItem = {
  orderSpecs?: OrderSpecs;
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

export default function AdminOrderBuilder({ allCategories, allCustomers, initialCustomerId = null, repeatItems = [], initialRequestType = 'Place Order' }: { allCategories: Category[]; allCustomers: Customer[]; initialCustomerId?: number | null; repeatItems?: CartItem[]; initialRequestType?: string }) {
  const router = useRouter();

  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(initialCustomerId);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const [pickCategoryId, setPickCategoryId] = useState<number | 'all'>('all');
  const [optionsCache, setOptionsCache] = useState<Record<number, Options>>({});
  const [loadingOptions, setLoadingOptions] = useState(false);
  // Multi-select, matching the customer-facing pickers: one pass can add every
  // shape x colour x size the buyer asked for over the phone, instead of
  // re-picking the category for each line.
  const [pickShapeIds, setPickShapeIds] = useState<number[]>([]);
  const [pickSizeIdxs, setPickSizeIdxs] = useState<number[]>([]);
  const [pickColorIds, setPickColorIds] = useState<number[]>([]);
  const [pickQty, setPickQty] = useState('');

  const [cart, setCart] = useState<CartItem[]>(repeatItems);
  const [requestType, setRequestType] = useState(initialRequestType);
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
  useEffect(() => {
    if (pickCategoryId === 34 && currentOptions?.colors.length === 1) setPickColorIds([currentOptions.colors[0].id]);
  }, [pickCategoryId, currentOptions]);

  // Only sizes every picked shape actually offers, grouped by the millimetre
  // label -- picking Round + Oval should not offer a size only Round has.
  const sizesForShapes = useMemo(() => {
    if (!currentOptions || pickShapeIds.length === 0) return [] as { sizeMm: string; rows: Options['sizes'] }[];
    const bySizeMm = new Map<string, Options['sizes']>();
    currentOptions.sizes.forEach((sz) => {
      if (!pickShapeIds.includes(sz.shapeId)) return;
      if (!bySizeMm.has(sz.sizeMm)) bySizeMm.set(sz.sizeMm, []);
      bySizeMm.get(sz.sizeMm)!.push(sz);
    });
    const common: { sizeMm: string; rows: Options['sizes'] }[] = [];
    bySizeMm.forEach((rows, sizeMm) => {
      const covered = new Set(rows.map((r) => r.shapeId));
      if (pickShapeIds.every((id) => covered.has(id))) common.push({ sizeMm, rows });
    });
    return common.sort((a, b) => {
      const na = strictSizeNum(a.sizeMm), nb = strictSizeNum(b.sizeMm);
      if (Number.isNaN(na) && Number.isNaN(nb)) return a.sizeMm.localeCompare(b.sizeMm);
      if (Number.isNaN(na)) return 1;
      if (Number.isNaN(nb)) return -1;
      return na - nb;
    });
  }, [currentOptions, pickShapeIds]);

  const sizeOptions = useMemo(
    () => sizesForShapes.map((g, i) => ({ id: i, hotIds: g.rows.map((row) => row.id), name: `${g.sizeMm} mm` })),
    [sizesForShapes]
  );

  async function handleCategoryChange(categoryId: number | 'all') {
    setPickCategoryId(categoryId);
    setPickShapeIds([]);
    setPickSizeIdxs([]);
    setPickColorIds([]);
    if (categoryId === 'all' || optionsCache[categoryId]) return;
    setLoadingOptions(true);
    const res = await fetch(`/api/admin/categories/${categoryId}/options`);
    const data = await res.json().catch(() => null);
    setLoadingOptions(false);
    if (data) setOptionsCache((prev) => ({ ...prev, [categoryId]: data }));
  }

  // A shape sharing no size with what's already picked is greyed out here,
  // rather than leaving the size list to go dead with no explanation.
  const incompatibleShapes = useMemo(
    () => incompatibleShapeIds(currentOptions?.shapes || [], currentOptions?.sizes || [], pickShapeIds),
    [currentOptions, pickShapeIds]
  );

  function clearSelection() {
    setPickCategoryId('all');
    setPickShapeIds([]);
    setPickSizeIdxs([]);
    setPickColorIds([]);
    setPickQty('');
  }

  const hasSelection =
    pickCategoryId !== 'all' || pickShapeIds.length > 0 || pickColorIds.length > 0 ||
    pickSizeIdxs.length > 0 || pickQty !== '';

  const qtyNum = parseInt(pickQty, 10) || 0;
  const canAdd = pickCategoryId !== 'all' && pickShapeIds.length > 0 && pickSizeIdxs.length > 0 && pickColorIds.length > 0 && qtyNum > 0;
  const comboCount = pickShapeIds.length * pickColorIds.length * pickSizeIdxs.length;

  // One line per shape x colour x size combination, each at the entered
  // quantity -- same rule as the customer-facing builder.
  function addLine() {
    if (!canAdd || !currentOptions) return;
    const category = allCategories.find((c) => c.id === pickCategoryId)!;
    const added: CartItem[] = [];
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
          added.push({
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}-${shapeId}-${colorId}-${sizeIdx}`,
            categoryId: category.id,
            categoryName: category.name,
            shapeId: shape.id,
            shapeName: shape.name,
            sizeId: match.id,
            sizeMm: match.sizeMm,
            colorId: color.id,
            colorName: color.name,
            qty: qtyNum
          });
        }
      }
    }
    if (!added.length) return;
    setCart([...cart, ...added]);
    setPickSizeIdxs([]);
    setPickQty('');
  }

  function removeLine(id: string) {
    setCart(cart.filter((i) => i.id !== id));
  }

  // Looked up live from whichever category's options are cached, same as the
  // customer-facing builder -- not stored on the cart item itself.
  function unitPriceInr(item: CartItem): number | null {
    if(item.orderSpecs) return null;
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
          orderSpecs: i.orderSpecs,
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
                  <div style={{ padding: 10, fontSize: 12.5, color: '#756e5c' }}>Start typing a name or phone number to find a customer.</div>
                )}
                {customerSearch.trim() && filteredCustomers.length === 0 && (
                  <div style={{ padding: 10, fontSize: 12.5, color: '#756e5c' }}>No matching customers.</div>
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
        <div className="po-add-form" data-special-category={specialCategory(Number(pickCategoryId)) || undefined}>
          <div>
            <label className="po-label">Category</label>
            <IconSelect
              options={allCategories.map((c) => ({ id: c.id, name: c.name, refPhotoUrl: categoryIconUrl(c.slug) }))}
              value={pickCategoryId}
              onChange={handleCategoryChange}
              allLabel="Choose category"
              leading="photo"
              searchable
            />
          </div>
          {/* Same IconSelect the customer-facing pickers use: shape icons and
              real gemstone photos, colour swatches, search, hot-selling first
              and multi-select. These were bare native selects, which made
              picking one of two dozen G-code colours by name alone harder for
              the team than it is for the buyer. */}
          <div>
            <label className="po-label">Shape{pickShapeIds.length > 1 ? 's' : ''}</label>
            <IconSelect
              categoryId={Number(pickCategoryId) || undefined}
              multiple
              options={currentOptions?.shapes || []}
              values={pickShapeIds}
              onChange={(v) => { setPickShapeIds(v); setPickSizeIdxs([]); }}
              placeholder={!currentOptions ? (loadingOptions ? 'Loading…' : 'Pick a category first') : 'Choose shape(s)'}
              leading="icon"
              disabledIds={incompatibleShapes}
              disabledReason={NO_SHARED_SIZE_REASON}
              disabledNote={NO_SHARED_SIZE_NOTE}
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
            <input type="text" inputMode="numeric" className="po-qty-input" placeholder="e.g. 5000" value={pickQty} onChange={(e) => setPickQty(e.target.value.replace(/\D/g, ''))} />
          </div>
        </div>
        {specialCategory(Number(pickCategoryId)) && currentOptions && <SpecialOrderComposer showRequestType={false} key={pickCategoryId} categoryId={Number(pickCategoryId)} categoryName={allCategories.find(c=>c.id===Number(pickCategoryId))?.name||''} shapes={currentOptions.shapes} colors={currentOptions.colors} sizes={currentOptions.sizes} onAdd={line=>setCart(current=>[...current,line])} />}
<div hidden={!!specialCategory(Number(pickCategoryId))}>
          <button type="button" className="po-add-line-btn" onClick={addLine} disabled={!canAdd}>+ Add line to order</button>
          {hasSelection && <button type="button" className="po-clear-selection" onClick={clearSelection}>Clear selection</button>}
        </div>
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
                <div key={item.id} className="po-item-row po-item-row--simple">
                  <div className="po-item-main">
                    <strong>{item.shapeName} · {item.sizeMm}mm</strong>
                    <span>{item.categoryName} · {item.colorName}{item.orderSpecs && <small style={{display:"block"}}>{specText(item.orderSpecs,item.qty)}</small>} · {item.qty} pcs</span>
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
