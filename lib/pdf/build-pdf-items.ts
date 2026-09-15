import type { PdfItem } from './OrderPdfDocument';

// Pulled out of app/api/admin/orders/[id]/pdf/route.ts so it's unit-testable:
// order_items rows carry supplier_id/cost_price/cost_currency (internal-only
// fields -- the owner never reveals supplier or cost price to a customer),
// and this is the one place that decides what actually reaches the
// customer-facing PDF. Keeping the allow-list explicit here, rather than
// spreading the raw row, is what makes that guarantee something a test can
// actually check instead of just trusting the route body.
export function buildPdfItems(
  items: any[],
  maps: {
    categoryName: Record<number, string>;
    shapeName: Record<number, string>;
    sizeMm: Record<number, string>;
    colorName: Record<number, string>;
  }
): PdfItem[] {
  return (items || []).map((it: any) => ({
    categoryName: maps.categoryName[it.category_id] || '—',
    shapeName: maps.shapeName[it.shape_id] || '—',
    sizeMm: maps.sizeMm[it.shape_size_id] || it.custom_size || '—',
    colorName: maps.colorName[it.color_id] || '—',
    orderSpecs: it.order_specs || null,
    quantity: it.quantity,
    unitPrice: it.unit_price != null ? Number(it.unit_price) : null,
    requestType: it.request_type || 'Place Order'
  }));
}
