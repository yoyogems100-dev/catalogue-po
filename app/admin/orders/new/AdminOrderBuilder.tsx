'use client';
import { QUOTATIONS_ENABLED } from '@/lib/cart-storage';
import SpecialOrderComposer from '@/components/SpecialOrderComposer';
import PasteListDialog from '@/components/PasteListDialog';
import type { PastedLine } from '@/lib/paste-order';
import { cleanLineNote } from '@/lib/line-note';
import {specialCategory,specKey,specText,gradeSpec,type OrderSpecs} from '@/lib/order-specs';

import IconSelect from '@/components/IconSelect';
import { facetAvailability, pickedSizeRows, sizeGroupsOf } from '@/lib/faceted-picker';
import { incompatibleShapeIds, NO_SHARED_SIZE_NOTE, NO_SHARED_SIZE_REASON } from '@/lib/shape-size-compat';
import { categoryIconUrl } from '@/lib/category-icons';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CategoryPricing } from '@/lib/pricing-calc';
import { lineInrPrice } from '@/lib/pricing-calc';
import { maskPhone } from '@/lib/mask';
import MatchText from '@/components/MatchText';

type Category = { id: number; num: number; name: string; slug: string | null };
type Customer = { id: number; name: string | null; phone: string | null; company: string | null; place: string | null };

const CUSTOMER_LIMIT = 20;
const customerTitle = (c: Customer) => c.name?.trim() || c.company?.trim() || 'No name';
/** The muted second line: phone, company (unless it is already the title) and place. */
const customerDetails = (c: Customer) => {
  const company = c.company?.trim();
  const showCompany = company && company.toLowerCase() !== customerTitle(c).toLowerCase();
  return [maskPhone(c.phone), showCompany ? company : null, c.place?.trim()].filter(Boolean) as string[];
};
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
  note?: string | null;
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
  const [pasteOpen, setPasteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  // UI/UX audit ("Make customer lookup search-first instead of immediately
  // exposing the entire customer list"): an empty query now shows nothing
  // rather than the first 20 customers by default.
  // Every typed word must appear in the name, company or place, or (3+ digits)
  // in the phone -- so "ravi jaipur" or "4601" both find the buyer. Names that
  // start with the query come first.
  const customerMatches = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return [];
    const words = q.split(/\s+/);
    const digits = q.replace(/\D/g, '');
    return allCustomers
      .filter((c) => {
        const hay = `${c.name || ''} ${c.company || ''} ${c.place || ''}`.toLowerCase();
        return words.every((w) => hay.includes(w) || (digits.length >= 3 && (c.phone || '').replace(/\D/g, '').includes(digits)));
      })
      .sort((a, b) => Number(customerTitle(b).toLowerCase().startsWith(words[0])) - Number(customerTitle(a).toLowerCase().startsWith(words[0])));
  }, [allCustomers, customerSearch]);
  const filteredCustomers = customerMatches.slice(0, CUSTOMER_LIMIT);
  const [activeCustomer, setActiveCustomer] = useState(0);
  useEffect(() => { setActiveCustomer(0); }, [customerSearch]);

  function pickCustomer(id: number) {
    setSelectedCustomerId(id);
    setCustomerSearch('');
  }
  function onCustomerKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!filteredCustomers.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveCustomer((i) => Math.min(filteredCustomers.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveCustomer((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); pickCustomer(filteredCustomers[activeCustomer]?.id ?? filteredCustomers[0].id); }
  }
  useEffect(() => {
    document.getElementById(`cust-pick-${activeCustomer}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeCustomer]);
  // "No match" offers the typed text as a new customer: digits become the
  // phone, anything else the name.
  function addAsNewCustomer() {
    const q = customerSearch.trim();
    if (/^[\d\s+()-]{6,}$/.test(q)) setNewPhone(q); else setNewName(q);
    setCustomerMode('new');
  }

  const selectedCustomer = allCustomers.find((c) => c.id === selectedCustomerId) || null;
  const currentOptions = pickCategoryId !== 'all' ? optionsCache[pickCategoryId] : null;
  useEffect(() => {
    if (pickCategoryId === 34 && currentOptions?.colors.length === 1) setPickColorIds([currentOptions.colors[0].id]);
  }, [pickCategoryId, currentOptions]);

  // Only sizes every picked shape actually offers, grouped by the millimetre
  // label -- picking Round + Oval should not offer a size only Round has.
  // Shape and size can be picked in either order: each list offers only what
  // goes with the other's picks (lib/faceted-picker). Sizes index into the
  // category's full size list, so a size picked first survives a shape pick.
  const sizeGroups = useMemo(() => sizeGroupsOf(currentOptions?.sizes || []), [currentOptions]);
  const available = useMemo(
    () => facetAvailability((currentOptions?.shapes || []).map((s) => s.id), (currentOptions?.colors || []).map((c) => c.id), sizeGroups, null,
      { shapeIds: pickShapeIds, sizeIdxs: pickSizeIdxs, colorIds: pickColorIds }),
    [currentOptions, sizeGroups, pickShapeIds, pickSizeIdxs, pickColorIds]
  );
  const shapeOptions = useMemo(() => (currentOptions?.shapes || []).filter((s) => available.shapeIds.has(s.id)), [currentOptions, available]);
  const sizeOptions = useMemo(
    () => sizeGroups
      .map((g, i) => ({ id: i, hotIds: g.rows.filter((r) => !pickShapeIds.length || pickShapeIds.includes(r.shapeId)).map((row) => row.id), name: `${g.sizeMm} mm` }))
      .filter((o) => available.sizeIdxs.has(o.id)),
    [sizeGroups, available, pickShapeIds]
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
          const group = sizeGroups[sizeIdx];
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
    // The quantity stays for the next line; only the sizes clear.
    setPickSizeIdxs([]);
  }

  // A list pasted from WhatsApp or the order sheet, already matched line by line.
  function addPasted(lines: PastedLine[]) {
    setCart((current) => [...current, ...lines.map((l, i) => ({
      id: `${Date.now()}-${i}-${Math.random().toString(16).slice(2)}`,
      categoryId: l.categoryId,
      categoryName: l.categoryName,
      shapeId: l.shapeId,
      shapeName: l.shapeName,
      sizeId: l.sizeId,
      sizeMm: l.sizeMm,
      colorId: l.colorId,
      colorName: l.colorName,
      qty: l.qty,
      note: cleanLineNote(l.note),
      ...(l.grade ? { orderSpecs: gradeSpec(l.grade) } : {})
    }))]);
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
          qty: i.qty,
          note: i.note || null
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
          selectedCustomer ? (
            <div className="cust-pick-chosen">
              <span className="cust-pick-text">
                <strong>{customerTitle(selectedCustomer)}</strong>
                {customerDetails(selectedCustomer).length > 0 && <small>{customerDetails(selectedCustomer).join(' · ')}</small>}
              </span>
              <button type="button" className="btn-ghost cust-pick-change" onClick={() => setSelectedCustomerId(null)} aria-label="Change customer">Change</button>
            </div>
          ) : (
            <div className="cust-pick">
              <input
                type="search"
                placeholder="Search name, company, city or phone…"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                onKeyDown={onCustomerKeyDown}
                role="combobox"
                aria-expanded={filteredCustomers.length > 0}
                aria-controls="cust-pick-list"
                aria-activedescendant={filteredCustomers[activeCustomer] ? `cust-pick-${activeCustomer}` : undefined}
                aria-label="Search customers"
                autoComplete="off"
                enterKeyHint="go"
              />
              {!customerSearch.trim() ? (
                <p className="cust-pick-hint">Start typing a name, company, city or the last digits of a phone number.</p>
              ) : filteredCustomers.length === 0 ? (
                <div className="cust-pick-empty">
                  <span>No customer matches &ldquo;{customerSearch.trim()}&rdquo;.</span>
                  <button type="button" className="btn-ghost" onClick={addAsNewCustomer}>Add as new customer</button>
                </div>
              ) : (
                <>
                  <ul id="cust-pick-list" role="listbox" aria-label="Matching customers" className="cust-pick-list">
                    {filteredCustomers.map((c, i) => (
                      <li
                        key={c.id}
                        id={`cust-pick-${i}`}
                        role="option"
                        aria-selected={i === activeCustomer}
                        onMouseEnter={() => setActiveCustomer(i)}
                        onClick={() => pickCustomer(c.id)}
                      >
                        <strong><MatchText text={customerTitle(c)} query={customerSearch} /></strong>
                        {customerDetails(c).length > 0 && (
                          <small>
                            {customerDetails(c).map((d, j) => (
                              <span key={j}>{j > 0 && <span className="cust-pick-sep" aria-hidden="true"> · </span>}<MatchText text={d} query={customerSearch} /></span>
                            ))}
                          </small>
                        )}
                      </li>
                    ))}
                  </ul>
                  {customerMatches.length > CUSTOMER_LIMIT && (
                    <p className="cust-pick-hint">Showing {CUSTOMER_LIMIT} of {customerMatches.length} matches &mdash; keep typing to narrow down.</p>
                  )}
                </>
              )}
            </div>
          )
        ) : (
          <div style={{ display: 'flex', gap: 8, maxWidth: 480 }}>
            <input type="text" placeholder="Name (optional)" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <input type="tel" placeholder="Phone number" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          </div>
        )}
      </section>

      <section className="po-card">
        <div className="po-compose-head">
          <h2 className="po-heading">Add to Order</h2>
          <button type="button" className="po-paste-btn" onClick={() => setPasteOpen(true)}>Paste a list</button>
        </div>
        <PasteListDialog open={pasteOpen} onClose={() => setPasteOpen(false)} onAdd={addPasted} forAdmin />
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
              options={shapeOptions}
              values={pickShapeIds}
              onChange={setPickShapeIds}
              closeOnFirstPick={pickColorIds.length === 0}
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
              closeOnFirstPick={pickShapeIds.length === 0}
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
              placeholder={!currentOptions ? 'Pick a category first' : sizeOptions.length === 0 ? 'No size matches these picks' : 'Choose size(s)'}
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
                    {item.note && <span className="po-line-note-text">Note: {item.note}</span>}
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
          <div className="po-send-row" hidden={!QUOTATIONS_ENABLED && requestType === 'Place Order'}>
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
