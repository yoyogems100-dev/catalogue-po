'use client';

import { useRouter } from 'next/navigation';

const CART_KEY = 'yoyo_po_cart_v2';

type RepeatItem = {
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
  requestType: string;
};

// Inline "repeat this order" shortcut for a row on the orders LIST page (the
// per-order detail page has its own equivalent). Lands on Quick Order, which
// shows/edits the shared cart across every category -- same reasoning as the
// detail page's reorder button.
export default function RepeatOrderButton({ orderId, items }: { orderId: number; items: RepeatItem[] }) {
  const router = useRouter();

  function repeat(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    let cart: any[] = [];
    try {
      const raw = window.localStorage.getItem(CART_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      cart = Array.isArray(parsed) ? parsed : [];
    } catch {
      cart = [];
    }

    items.forEach((item) => {
      const requestType = item.requestType || 'Place Order';
      const existing = cart.find(
        (c) =>
          c.categoryId === item.categoryId &&
          c.shapeId === item.shapeId &&
          c.sizeId === item.sizeId &&
          c.colorId === item.colorId &&
          c.requestType === requestType
      );
      if (existing) {
        existing.qty += item.quantity;
      } else {
        cart.push({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          shapeId: item.shapeId,
          shapeName: item.shapeName,
          sizeId: item.sizeId,
          sizeMm: item.sizeMm,
          colorId: item.colorId,
          colorName: item.colorName,
          colorHex: item.colorHex,
          qty: item.quantity,
          requestType
        });
      }
    });

    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      // storage full/disabled -- nothing we can do, cart just won't persist
    }

    router.push('/account/quick-order');
  }

  return (
    <button type="button" className="btn-ghost account-order-repeat-btn" onClick={repeat}>
      Repeat order
    </button>
  );
}
