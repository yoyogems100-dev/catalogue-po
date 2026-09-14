// Pure pricing lookup -- no imports, safe to use in both server code and the
// browser bundle. Prices are stored per shape+size+color-GROUP (matching the
// supplier sheet's own layout), so pricing an actual line item means first
// resolving its color to a group, then looking up that group's price.
export type CategoryPricing = {
  // null when the conversion rate hasn't been configured (or was cleared/invalid) --
  // callers must treat that as "no price available", never fall back to a default
  // multiplier, since that would silently show/save an RMB-face-value price as if
  // it were INR (understating it roughly tenfold at real-world rates).
  multiplier: number | null;
  colorToGroup: Record<number, number>;
  priceMap: Record<string, number>; // `${shapeId}:${shapeSizeId}:${groupId}` -> price in RMB
};

export function lineRmbPrice(pricing: CategoryPricing, shapeId: number, shapeSizeId: number, colorId: number): number | null {
  const groupId = pricing.colorToGroup[colorId];
  if (groupId === undefined) return null;
  const rmb = pricing.priceMap[`${shapeId}:${shapeSizeId}:${groupId}`];
  return rmb === undefined ? null : rmb;
}

export function lineInrPrice(pricing: CategoryPricing, shapeId: number, shapeSizeId: number, colorId: number): number | null {
  // Re-check validity here too, not just at the source -- this is the last line
  // of defense against ever multiplying a real RMB price by a null/zero/negative
  // rate and returning a wrong-but-plausible-looking number. `> 0` on null is
  // false, so this correctly rejects null along with 0 and negatives.
  const multiplier = pricing.multiplier;
  if (!(multiplier && multiplier > 0)) return null;
  const rmb = lineRmbPrice(pricing, shapeId, shapeSizeId, colorId);
  return rmb === null ? null : rmb * multiplier;
}

// A saved settings value of "", "0", a negative number, or nothing at all must
// all mean "not configured" -- never a usable rate. Shared by every call site
// that reads the rmb_inr_multiplier setting, so the fail-safe rule can't drift.
export function parseMultiplier(rawValue: unknown): number | null {
  const n = Number(rawValue);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function cartLinePrice(pricing: CategoryPricing | undefined, activeCategoryId: number,
  item: { orderSpecs?: unknown; categoryId: number; shapeId: number; sizeId: number | null; colorId: number }): number | null {
  // A saved requirement can contain several categories; the page only has its own price list.
  if (item.orderSpecs || !pricing || item.categoryId !== activeCategoryId || item.sizeId == null) return null;
  return lineInrPrice(pricing, item.shapeId, item.sizeId, item.colorId);
}
