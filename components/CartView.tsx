'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import IconSelect from './IconSelect';
import ColorSwatch from './ColorSwatch';
import ShapeReferenceImage from './ShapeReferenceImage';
import QuantityInput from './QuantityInput';
import LoginForm from './LoginForm';
import QuickOrderButton from './QuickOrderButton';
import WhatsAppIcon from './admin/WhatsAppIcon';
import { specText, quantityFactor } from '@/lib/order-specs';
import { cartLinePrice, type CategoryPricing } from '@/lib/pricing-calc';
import {
  CART_EVENT, loadCart, mergeIntoCart, saveCart,
  type CartItem, type RequestType
} from '@/lib/cart-storage';
import { formatRupees } from '@/lib/money';
import { groupLines, type LineGroupBy } from '@/lib/cart-grouping';

// Glass Pearls is always Round and never shows the shape to the customer, so
// the colour -- the thing that actually varies -- is the meaningful image.
const GLASS_PEARLS_CATEGORY_ID = 16;

type ShapeRef = { id: number; name: string; iconKey?: string | null; refPhotoUrl?: string | null };
type ColorRef = { id: number; name: string; hex?: string | null; refPhotoUrl?: string | null };
type SizeRef = { id: number; shape_id: number; size_mm: string };
type CategoryOptions = { name?: string; qtyUnit?: string | null; shapes: ShapeRef[]; colors: ColorRef[]; sizes: SizeRef[] };

// Leading number of a size ("4", "4x6", "1.5") for ordering lines small to large.
function sizeSortKey(sizeMm: string): number {
  const n = parseFloat(sizeMm);
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
}

/**
 * The whole requirement, on its own page.
 *
 * It used to sit inline under the builder on every category page, which meant
 * it was below the fold while lines were being added, it couldn't be reached
 * from anywhere else on the site, and it took the space where reference photos
 * are far more useful. Here it gets the screen to itself, and the header bag
 * reaches it from any page.
 *
 * Lines can span any number of categories, so prices and the shape/colour/size
 * options needed to edit a line are fetched per category present in the cart.
 */
export default function CartView({ loggedIn = false, whatsappNumber }: {
  loggedIn?: boolean;
  whatsappNumber?: string;
}) {
  const [cart, setCartState] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [pricingByCategory, setPricingByCategory] = useState<Record<number, CategoryPricing>>({});
  const [optionsByCategory, setOptionsByCategory] = useState<Record<number, CategoryOptions>>({});
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState<{ id: number; whatsappUrl: string; quotation: boolean } | null>(null);
  const [toast, setToast] = useState('');
  // The line just removed and where it sat, so the removal can be undone.
  const [removed, setRemoved] = useState<{ item: CartItem; index: number; message: string } | null>(null);
  const canUndoRemove = !!removed && removed.message === toast;
  const [editingOption, setEditingOption] = useState<{ itemId: string; kind: 'size' | 'color'; values: number[] } | null>(null);
  // Collapsed category groups, keyed by request type + category so Purchase and
  // Quotation fold independently. A fifty-line requirement spanning several
  // categories is unreadable as one long list; folding a category you've
  // already checked keeps the rest on screen.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const submissionPending = useRef(false);

  function setCart(next: CartItem[]) {
    setCartState(next);
    saveCart(next);
  }

  useEffect(() => { setCartState(loadCart()); setHydrated(true); }, []);
  useEffect(() => {
    // Another tab editing the same draft.
    const read = () => setCartState(loadCart());
    window.addEventListener('storage', read);
    window.addEventListener(CART_EVENT, read);
    return () => { window.removeEventListener('storage', read); window.removeEventListener(CART_EVENT, read); };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => { setToast(''); setRemoved(null); }, canUndoRemove ? 6000 : 2600);
    return () => clearTimeout(t);
  }, [toast, canUndoRemove]);

  const categoryIds = useMemo(
    () => Array.from(new Set(cart.map((i) => i.categoryId))).sort((a, b) => a - b),
    [cart]
  );
  const categoryKey = categoryIds.join(',');

  useEffect(() => {
    if (!categoryKey) return;
    let active = true;
    Promise.all([
      fetch(`/api/category-pricing?ids=${categoryKey}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/api/category-options?ids=${categoryKey}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    ]).then(([priceData, optionData]) => {
      if (!active) return;
      if (priceData?.pricing) setPricingByCategory((prev) => ({ ...prev, ...priceData.pricing }));
      if (optionData?.options) setOptionsByCategory((prev) => ({ ...prev, ...optionData.options }));
    });
    return () => { active = false; };
  }, [categoryKey]);


  function unitPriceInr(item: CartItem): number | null {
    // A quotation is a request for a price, so it never displays one.
    if (item.requestType === 'Request Quotation') return null;
    return cartLinePrice(pricingByCategory, item);
  }
  const cartTotalInr = cart.reduce((sum, item) => {
    const unit = unitPriceInr(item);
    return unit === null ? sum : sum + unit * item.qty;
  }, 0);
  const hasAnyPricedLine = cart.some((item) => unitPriceInr(item) !== null);
  const unpricedLines = cart.filter((item) => unitPriceInr(item) === null).length;

  function updateQty(id: string, qty: number) {
    setCart(cart.map((i) => {
      if (i.id !== id) return i;
      const floor = i.requestType === 'Request Quotation' ? 0 : 1;
      return { ...i, qty: Math.max(floor, qty) };
    }));
  }
  function updateItemRequestType(id: string, requestType: RequestType) {
    setCart(cart.map((i) => (i.id === id ? { ...i, requestType } : i)));
  }
  function removeItem(id: string) {
    const index = cart.findIndex((i) => i.id === id);
    if (index < 0) return;
    const message = `Removed ${cart[index].shapeName} ${cart[index].sizeMm} mm`;
    setRemoved({ item: cart[index], index, message });
    setCart(cart.filter((i) => i.id !== id));
    setToast(message);
  }
  function undoRemove() {
    if (!removed) return;
    const next = [...cart];
    next.splice(Math.min(removed.index, next.length), 0, removed.item);
    setCart(next);
    setRemoved(null);
    setToast('Line restored');
  }
  // A line keeps the category name it was added under; show today's name once
  // the category's details have loaded, so a renamed category doesn't linger.
  const categoryLabel = (item: CartItem) => optionsByCategory[item.categoryId]?.name || item.categoryName;
  // Lines added before a category had its own unit carry none; today's wins.
  const unitOf = (item: CartItem) => optionsByCategory[item.categoryId]?.qtyUnit ?? item.qtyUnit ?? null;

  function replaceItemOptions(item: CartItem, nextSizeIds: number[], nextColorIds: number[]) {
    const opts = optionsByCategory[item.categoryId];
    if (!opts) return;
    let next = cart.filter((line) => line.id !== item.id);
    for (const sizeId of nextSizeIds) {
      const size = opts.sizes.find((o) => o.id === sizeId && o.shape_id === item.shapeId);
      if (!size) continue;
      for (const colorId of nextColorIds) {
        const color = opts.colors.find((o) => o.id === colorId);
        if (!color) continue;
        next = mergeIntoCart(next, {
          ...item,
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          sizeId: size.id,
          sizeMm: size.size_mm,
          colorId: color.id,
          colorName: color.name,
          colorHex: color.hex || '#ccc',
          colorRefPhotoUrl: color.refPhotoUrl || null
        });
      }
    }
    setCart(next);
    setEditingOption(null);
  }

  const whatsappDigits = (whatsappNumber || '').replace(/\D/g, '');

  // One tap saves the requirement and hands it to WhatsApp. It used to take
  // three: Send requirement, the same button again in a confirm popup, then
  // Share on WhatsApp on the receipt. The cart page already is the review.
  async function sendRequirement() {
    if (submissionPending.current) return;
    if (cart.length === 0) { setToast('Add at least one line to your requirement first.'); return; }
    submissionPending.current = true;
    setSending(true);
    // Browsers only allow a new tab from the tap itself, not after the save
    // returns, so open it now and point it at WhatsApp once the order exists.
    const waTab = whatsappDigits ? window.open('', '_blank') : null;
    if (waTab) waTab.document.title = 'Opening WhatsApp…';
    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart, comment })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save order');

      const url = whatsappDigits
        ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(data.message)}`
        : `https://wa.me/?text=${encodeURIComponent(data.message)}`;
      if (waTab) waTab.location.href = url;
      setReceipt({ id: data.orderId, whatsappUrl: url, quotation: cart.every((i) => i.requestType === 'Request Quotation') });

      setCart([]);
      setComment('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      waTab?.close();
      setToast(err.message || 'Something went wrong. Please try again.');
    } finally {
      submissionPending.current = false;
      setSending(false);
    }
  }

  function StoneReference({ item }: { item: CartItem }) {
    const opts = optionsByCategory[item.categoryId];
    const shape = opts?.shapes.find((s) => s.id === item.shapeId);
    const src = item.categoryId === GLASS_PEARLS_CATEGORY_ID
      ? (item.colorRefPhotoUrl || item.shapeRefPhotoUrl)
      : (item.shapeRefPhotoUrl || shape?.refPhotoUrl || null);
    return (
      <span className="requirement-stone">
        <ShapeReferenceImage name={item.shapeName} src={src} iconKey={item.shapeIconKey || shape?.iconKey} fallbackSize={36} />
      </span>
    );
  }

  function ItemOptionEditor({ item, editing, onApply, onDiscard }: {
    item: CartItem;
    editing: { itemId: string; kind: 'size' | 'color'; values: number[] };
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

    const opts = optionsByCategory[item.categoryId];
    if (!opts) return null;
    return (
      <div className="po-item-option-editor" ref={panelRef}>
        <button type="button" className="po-item-option-close" aria-label="Close without saving" onClick={onDiscard}>&times;</button>
        <div className="po-item-option-row">
          <IconSelect
            categoryId={item.categoryId}
            multiple
            optionKind={editing.kind === 'size' ? 'size' : undefined}
            options={editing.kind === 'size'
              ? opts.sizes.filter((o) => o.shape_id === item.shapeId).map((o) => ({ id: o.id, name: `${o.size_mm} mm` }))
              : opts.colors}
            values={editing.values}
            onChange={(values) => setEditingOption({ ...editing, values })}
            placeholder={editing.kind === 'size' ? 'Choose sizes' : 'Choose colors'}
            leading={editing.kind === 'color' ? 'swatch' : undefined}
          />
          <button type="button" className="btn" onClick={onApply}>Apply</button>
        </div>
        <p>Select one or more. Clearing all removes this line.</p>
      </div>
    );
  }

  if (!hydrated) return <div className="po-empty po-cart-loading">Loading your requirement…</div>;

  if (cart.length === 0 && !receipt) {
    return (
      <div className="cart-empty-state">
        <h2 className="po-heading">Your requirement is empty</h2>
        <p>Browse the collection and add shapes, sizes and colours — they&rsquo;ll gather here, across as many categories as you like.</p>
        {/* Removing the last line lands here, so the Undo has to as well. */}
        {canUndoRemove && (
          <p className="po-type-hint">{toast}. <button type="button" className="po-inline-link" onClick={undoRemove}>Undo</button></p>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn" href="/po">Browse the collection</Link>
          <QuickOrderButton />
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page-wrap">
      <section className="po-card po-cart-card">
        <div className="po-cart-head">
          <h2 className="po-heading">Your Requirement</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <QuickOrderButton label="Add to Order" />
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

        {cart.length > 0 && (
          <div className="po-requirement-groups">
            {([
              { type: 'Place Order' as RequestType, title: 'Purchase', moveLabel: null },
              { type: 'Request Quotation' as RequestType, title: 'Request quotation', moveLabel: 'Move to purchase' }
            ]).map((group) => {
              const groupItems = cart.filter((item) => item.requestType === group.type);
              if (groupItems.length === 0) return null;
              const isQuote = group.type === 'Request Quotation';
              // Newest category first; inside a category, lines run by shape and
              // then size small to large, so a long list reads like a checklist.
              const categoryGroups: { categoryId: number; categoryName: string; items: CartItem[] }[] = [];
              const categoryIndex = new Map<number, number>();
              for (const item of [...groupItems].reverse()) {
                if (!categoryIndex.has(item.categoryId)) {
                  categoryIndex.set(item.categoryId, categoryGroups.length);
                  categoryGroups.push({ categoryId: item.categoryId, categoryName: categoryLabel(item), items: [] });
                }
                categoryGroups[categoryIndex.get(item.categoryId)!].items.push(item);
              }
              for (const g of categoryGroups) {
                g.items.sort((a, b) =>
                  a.shapeName.localeCompare(b.shapeName) ||
                  sizeSortKey(a.sizeMm) - sizeSortKey(b.sizeMm) ||
                  a.sizeMm.localeCompare(b.sizeMm) ||
                  a.colorName.localeCompare(b.colorName));
              }
              return (
                <section className="po-requirement-group" key={group.type} aria-label={group.title}>
                  <header className="po-requirement-group-head">
                    <h3>{group.title}</h3>
                  </header>
                  {isQuote && <p className="po-type-hint">Quantity is optional here — we&rsquo;ll send prices, then you decide.</p>}
                  {categoryGroups.map((catGroup) => (
                    <div className="po-requirement-category" key={catGroup.categoryId}>
                      {(() => {
                        const key = `${group.type}:${catGroup.categoryId}`;
                        const isCollapsed = !!collapsed[key];
                        return (
                          <button
                            type="button"
                            className="po-requirement-category-head"
                            aria-expanded={!isCollapsed}
                            onClick={() => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))}
                          >
                            <span className="po-cat-caret" aria-hidden="true">{isCollapsed ? '\u25B8' : '\u25BE'}</span>
                            <strong>{catGroup.categoryName}</strong>
                          </button>
                        );
                      })()}
                      <div className="po-item-list" hidden={!!collapsed[`${group.type}:${catGroup.categoryId}`]}>
                        {(catGroup.categoryId === GLASS_PEARLS_CATEGORY_ID
                          ? [{ by: null, id: 0, name: '', items: catGroup.items }]
                          : groupLines(catGroup.items)
                        ).map((lineGroup) => (
                        <div className="po-line-group" key={`${lineGroup.by}:${lineGroup.id}`}>
                          {lineGroup.by && (
                            <div className="po-line-group-head">
                              {lineGroup.by === 'shape'
                                ? <StoneReference item={lineGroup.items[0]} />
                                : <ColorSwatch hex={lineGroup.items[0].colorHex} refPhotoUrl={lineGroup.items[0].colorRefPhotoUrl} name={lineGroup.name} size={18} />}
                              <strong>{lineGroup.name}</strong>
                              <span>{lineGroup.items.length} {lineGroup.items.length === 1 ? 'line' : 'lines'}</span>
                            </div>
                          )}
                        {lineGroup.items.map((item) => {
                          const groupedBy: LineGroupBy | null = lineGroup.by;
                          const unit = unitPriceInr(item);
                          const canEdit = !!optionsByCategory[item.categoryId] && !item.orderSpecs;
                          return (
                            <div key={item.id} className="po-item-row">
                              <StoneReference item={item} />
                              <div className="po-item-details">
                                <strong>
                                  {item.categoryId !== GLASS_PEARLS_CATEGORY_ID && groupedBy !== 'shape' && `${item.shapeName} · `}
                                  {canEdit && item.sizeId
                                    ? <button type="button" className="po-item-option-link" onClick={() => setEditingOption({ itemId: item.id, kind: 'size', values: [item.sizeId!] })}>{item.sizeMm}mm</button>
                                    : `${item.sizeMm}mm`}
                                </strong>
                                <span>
                                  {item.categoryId !== GLASS_PEARLS_CATEGORY_ID && <ColorSwatch hex={item.colorHex} refPhotoUrl={item.colorRefPhotoUrl} name={item.colorName} size={13} />}
                                  {canEdit
                                    ? <button type="button" className="po-item-option-link" onClick={() => setEditingOption({ itemId: item.id, kind: 'color', values: [item.colorId] })}>{item.colorName}</button>
                                    : item.colorName}
                                  {item.orderSpecs && <small style={{ display: 'block' }}>{specText(item.orderSpecs, item.qty)}</small>}
                                </span>
                                {unit !== null && (
                                  <span className="po-item-price">&#8377;{formatRupees(unit)} &times; {item.qty.toLocaleString('en-IN')} = &#8377;{formatRupees(unit * item.qty)}</span>
                                )}
                                {isQuote && <span className="po-item-price po-item-on-request">Price on request</span>}
                                {group.moveLabel && (
                                  <button type="button" className="po-item-move-btn" onClick={() => updateItemRequestType(item.id, 'Place Order')}>
                                    {group.moveLabel}
                                  </button>
                                )}
                              </div>
                              {item.requestType === 'Request Quotation' && item.qty === 0 ? (
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
                                <label className="po-item-qty"><span>Qty ({item.orderSpecs?.kind === 'rainbow' ? 'strips' : item.orderSpecs?.kind === 'carat' ? 'ct' : unitOf(item) || 'pcs'})</span>
                                  <QuantityInput
                                    value={item.qty / quantityFactor(item.orderSpecs)}
                                    label={`Quantity for ${item.shapeName} ${item.sizeMm} mm ${item.colorName}`}
                                    onChange={(quantity) => updateQty(item.id, quantity * quantityFactor(item.orderSpecs))}
                                    onInvalid={() => setToast('Enter a positive whole quantity. The previous quantity has been kept.')}
                                  />
                                </label>
                              )}
                              <button type="button" className="po-remove-btn" aria-label={`Remove ${item.shapeName} ${item.sizeMm} mm ${item.colorName}`} onClick={() => removeItem(item.id)}>&times;</button>
                              {editingOption?.itemId === item.id && (
                                <ItemOptionEditor
                                  item={item}
                                  editing={editingOption}
                                  onDiscard={() => setEditingOption(null)}
                                  onApply={() => replaceItemOptions(
                                    item,
                                    editingOption.kind === 'size' ? editingOption.values : (item.sizeId ? [item.sizeId] : []),
                                    editingOption.kind === 'color' ? editingOption.values : [item.colorId]
                                  )}
                                />
                              )}
                            </div>
                          );
                        })}
                        </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
              );
            })}
          </div>
        )}

        {hasAnyPricedLine && (
          <div className="po-cart-total">
            {unpricedLines ? 'Priced lines subtotal' : 'Estimated total'}: &#8377;{formatRupees(cartTotalInr)}
            {/* No "N lines need price confirmation" note: buyers already know
                unlisted items are priced by the team (owner, 2026-09-25). */}
          </div>
        )}

        {receipt && <div className="po-card po-receipt" role="status" aria-live="polite">
          <h3>{receipt.quotation ? 'Quotation requested' : 'Order placed'} — #{receipt.id}</h3>
          <p>Requirement saved. You can view its status under My Orders.</p>
          {!loggedIn && <p>Guest orders appear in My Orders when you sign in with the WhatsApp number provided. Without a number, keep this reference and contact our team.</p>}
          <div className="po-receipt-actions">
            {whatsappDigits && (
              <a className="po-send-btn po-send-btn-wa" href={receipt.whatsappUrl} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon size={18} /> WhatsApp didn&rsquo;t open? Tap here
              </a>
            )}
            <Link className="btn-ghost" href={`/po/account/orders/${receipt.id}`}>View in My Orders</Link>
            <Link className="btn-ghost" href="/po">Continue browsing</Link>
          </div>
        </div>}

        {cart.length > 0 && <div className="po-send-box">
          <label className="po-block-label">
            Additional comment
            <textarea rows={3} placeholder="Message" value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>

          {loggedIn ? (
            <>
              <button type="button" className={`po-send-btn${whatsappDigits ? ' po-send-btn-wa' : ''}`} onClick={() => { setToast(''); sendRequirement(); }} disabled={sending || cart.length === 0}>
                {whatsappDigits
                  ? <WhatsAppIcon size={18} />
                  : <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m3 3 18 9-18 9 4-9-4-9Zm4 9h14" /></svg>}
                {sending ? 'Sending…' : 'Send requirement'}
              </button>
            </>
          ) : (
            // A requirement used to be sendable with no name and no number at
            // all, which left the team with an order they could not reply to.
            // Signing in captures the number once, verifies it, and keeps the
            // order in the buyer's own history instead of stranding it.
            <div className="cart-signin">
              <h3 className="po-heading">Log in to send this requirement</h3>
              <LoginForm autoFocus={false} onSuccess={() => window.location.reload()} />
            </div>
          )}
        </div>}
      </section>

      {toast && (
        <div className="po-toast" role="status" aria-live="polite">
          {toast}
          {canUndoRemove && <button type="button" className="po-toast-undo" onClick={undoRemove}>Undo</button>}
        </div>
      )}
    </div>
  );
}
