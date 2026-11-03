'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import ColorSwatch from './ColorSwatch';
import QuantityInput from './QuantityInput';
import { quantityFactor, specText } from '@/lib/order-specs';
import type { CartItem } from '@/lib/cart-storage';

export const IN_ORDER_ANCHOR = 'in-order';

/**
 * This stone's lines already in the requirement, on its own page: the cart
 * links each category here ("Edit or add"), so a buyer can change quantities,
 * drop lines and add more in one place (owner, 2026-10-30). Folded to one bar
 * unless the buyer came from the cart, so it doesn't push the order form down.
 */
export default function CategoryOrderLines({ categoryId, cart, onChange, onRemoved, unitLabel }: {
  categoryId: number;
  cart: CartItem[];
  onChange: (next: CartItem[]) => void;
  onRemoved: (message: string, before: CartItem[]) => void;
  unitLabel?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const lines = cart
    .filter((i) => i.categoryId === categoryId)
    .sort((a, b) =>
      a.shapeName.localeCompare(b.shapeName) ||
      (parseFloat(a.sizeMm) || 0) - (parseFloat(b.sizeMm) || 0) ||
      a.sizeMm.localeCompare(b.sizeMm) ||
      a.colorName.localeCompare(b.colorName));
  const hasLines = lines.length > 0;

  // Arriving from the cart: open and bring the list into view once the saved
  // cart has loaded (the browser's own jump to #in-order happens before that).
  useEffect(() => {
    if (!hasLines || window.location.hash !== `#${IN_ORDER_ANCHOR}`) return;
    setOpen(true);
    requestAnimationFrame(() => ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  }, [hasLines]);

  if (!hasLines) return null;

  function setQty(id: string, qty: number) {
    onChange(cart.map((i) => (i.id === id ? { ...i, qty: Math.max(i.requestType === 'Request Quotation' ? 0 : 1, qty) } : i)));
  }
  function remove(item: CartItem) {
    onChange(cart.filter((i) => i.id !== item.id));
    onRemoved(`Removed ${item.shapeName} ${item.sizeMm} mm ${item.colorName}`, cart);
  }
  const unitOf = (item: CartItem) =>
    item.orderSpecs?.kind === 'rainbow' ? 'strips' : item.orderSpecs?.kind === 'carat' ? 'ct' : unitLabel || item.qtyUnit || 'pcs';

  return (
    <section className="po-card po-in-order" id={IN_ORDER_ANCHOR} ref={ref} aria-label="In your order">
      <button type="button" className="po-in-order-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="po-cat-caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
        <strong>In your order</strong>
        <span className="po-in-order-count">{lines.length} {lines.length === 1 ? 'line' : 'lines'}</span>
      </button>
      {open && (
        <>
          <ul className="po-in-order-list">
            {lines.map((item) => (
              <li key={item.id} className="po-in-order-row">
                <ColorSwatch hex={item.colorHex} refPhotoUrl={item.colorRefPhotoUrl} name={item.colorName} size={26} />
                <span className="po-in-order-name">
                  <b>{item.shapeName} · {item.sizeMm} mm</b>
                  <span>{item.colorName}{item.orderSpecs ? ` · ${specText(item.orderSpecs, item.qty)}` : ''}</span>
                </span>
                <label className="po-in-order-qty">
                  <span>Qty ({unitOf(item)})</span>
                  <QuantityInput
                    value={item.qty / quantityFactor(item.orderSpecs)}
                    allowEmpty={item.requestType === 'Request Quotation'}
                    label={`Quantity for ${item.shapeName} ${item.sizeMm} mm ${item.colorName}`}
                    onChange={(q) => setQty(item.id, q * quantityFactor(item.orderSpecs))}
                    onInvalid={() => undefined}
                  />
                </label>
                <button type="button" className="po-remove-btn" aria-label={`Remove ${item.shapeName} ${item.sizeMm} mm ${item.colorName}`} onClick={() => remove(item)}>&times;</button>
              </li>
            ))}
          </ul>
          <p className="po-in-order-foot">
            Add more with the form above. <Link href="/po/cart">Review the whole order &rsaquo;</Link>
          </p>
        </>
      )}
    </section>
  );
}
