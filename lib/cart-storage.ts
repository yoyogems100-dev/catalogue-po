import { specKey, type OrderSpecs } from './order-specs';

// The requirement draft is shared between the category-page builder (which adds
// lines) and /cart (which reviews and submits them), so the shape of a line and
// the rules for storing/merging one live here rather than inside either screen.

export type RequestType = 'Place Order' | 'Request Quotation';

export type CartItem = {
  orderSpecs?: OrderSpecs;
  id: string;
  categoryId: number;
  categoryName: string;
  shapeId: number;
  shapeName: string;
  shapeRefPhotoUrl?: string | null;
  shapeIconKey?: string | null;
  sizeId: number | null;
  sizeMm: string;
  colorId: number;
  colorName: string;
  colorHex: string;
  colorRefPhotoUrl?: string | null;
  qty: number;
  requestType: RequestType;
};

export const CART_KEY = 'yoyo_po_cart_v2';

/** Fired on the same tab after any write, so a header bag or summary bar can
 *  track the count without polling. `storage` only fires in OTHER tabs. */
export const CART_EVENT = 'yoyo-cart-change';

export function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCart(cart: CartItem[]) {
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    // storage full or disabled -- cart still works in-memory for this session
  }
  try {
    window.dispatchEvent(new CustomEvent(CART_EVENT));
  } catch {
    // CustomEvent unavailable -- listeners just won't live-update
  }
}

/** Quantities are whole pieces, so the same shape+size+colour+type in the same
 *  category is one line at the combined quantity rather than two identical
 *  rows the team would have to reconcile by hand. Callers enrich `item` with
 *  the shape's photo/icon before calling -- only the builder has that data. */
export function mergeIntoCart(current: CartItem[], item: CartItem): CartItem[] {
  const existing = current.find(
    (i) =>
      i.categoryId === item.categoryId &&
      i.shapeId === item.shapeId &&
      i.colorId === item.colorId &&
      i.sizeId === item.sizeId &&
      i.requestType === item.requestType &&
      specKey(i.orderSpecs) === specKey(item.orderSpecs)
  );
  if (existing) return current.map((i) => (i.id === existing.id ? { ...i, qty: i.qty + item.qty } : i));
  return [...current, item];
}

export function cartPieces(cart: CartItem[]): number {
  return cart.reduce((sum, i) => sum + i.qty, 0);
}
