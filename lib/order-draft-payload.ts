// What a saved draft order holds: the admin order builder's own state, cleaned
// so only known fields of sane size are stored. Pure -- shared by the drafts
// API and its tests.

export type DraftLine = {
  id: string;
  categoryId: number;
  categoryName: string;
  shapeId: number;
  shapeName: string;
  sizeId: number;
  sizeMm: string;
  colorId: number;
  colorName: string;
  colorCode?: string | null;
  qty: number;
  note?: string | null;
  orderSpecs?: Record<string, unknown>;
};

export type DraftPayload = {
  customerMode: 'existing' | 'new';
  selectedCustomerId: number | null;
  newName: string;
  newPhone: string;
  requestType: string;
  comment: string;
  fromJaipur: boolean;
  cart: DraftLine[];
};

export const MAX_DRAFT_LINES = 1000;

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const int = (v: unknown) => { const n = Number(v); return Number.isSafeInteger(n) ? n : 0; };

export function cleanDraftPayload(body: unknown): { payload: DraftPayload; customerId: number | null } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Nothing to save.' };
  const b = body as Record<string, any>;
  if (b.cart !== undefined && !Array.isArray(b.cart)) return { error: 'Bad order lines.' };
  const rawCart: any[] = Array.isArray(b.cart) ? b.cart : [];
  if (rawCart.length > MAX_DRAFT_LINES) return { error: `A draft can hold up to ${MAX_DRAFT_LINES} lines.` };

  const customerMode = b.customerMode === 'new' ? 'new' : 'existing';
  const selectedCustomerId = customerMode === 'existing' && int(b.selectedCustomerId) > 0 ? int(b.selectedCustomerId) : null;
  const cart: DraftLine[] = rawCart
    .filter((l) => l && typeof l === 'object')
    .map((l, i) => {
      const line: DraftLine = {
        id: text(l.id, 120) || `draft-${i}`,
        categoryId: int(l.categoryId),
        categoryName: text(l.categoryName, 200),
        shapeId: int(l.shapeId),
        shapeName: text(l.shapeName, 200),
        sizeId: int(l.sizeId),
        sizeMm: text(l.sizeMm, 60),
        colorId: int(l.colorId),
        colorName: text(l.colorName, 200),
        colorCode: l.colorCode ? text(l.colorCode, 60) : null,
        qty: Math.max(0, int(l.qty)),
        note: l.note ? text(l.note, 1000) : null
      };
      if (l.orderSpecs && typeof l.orderSpecs === 'object' && !Array.isArray(l.orderSpecs)) line.orderSpecs = l.orderSpecs;
      return line;
    });

  const payload: DraftPayload = {
    customerMode,
    selectedCustomerId,
    newName: customerMode === 'new' ? text(b.newName, 200) : '',
    newPhone: customerMode === 'new' ? text(b.newPhone, 40) : '',
    requestType: b.requestType === 'Request Quotation' ? 'Request Quotation' : 'Place Order',
    comment: text(b.comment, 4000),
    fromJaipur: b.fromJaipur === true,
    cart
  };
  if (!payload.cart.length && !payload.selectedCustomerId && !payload.newName.trim() && !payload.newPhone.trim() && !payload.comment.trim()) {
    return { error: 'Pick a customer or add a line before saving a draft.' };
  }
  if (JSON.stringify(payload).length > 1_000_000) return { error: 'This draft is too large to save.' };
  return { payload, customerId: selectedCustomerId };
}
