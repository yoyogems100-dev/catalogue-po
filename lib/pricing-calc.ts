// Pure pricing lookup -- no imports, safe to use in both server code and the
// browser bundle. Prices are stored per shape+size+color-GROUP (matching the
// supplier sheet's own layout), so pricing an actual line item means first
// resolving its color to a group, then looking up that group's price.
export type CategoryPricing = {
  colorToGroup: Record<number, number>;
  priceMap: Record<string, number>; // `${shapeId}:${shapeSizeId}:${groupId}` -> price in INR
  /** The reserved group meaning "every colour with no group of its own".
      Most categories don't price by colour at all, so this is where their one
      price per shape+size lives. Optional so a caller holding only a price map
      -- a test, a cached payload from before this existed -- still type-checks
      and simply gets no fallback. */
  catchAllGroupId?: number | null;
};

export function lineInrPrice(pricing: CategoryPricing, shapeId: number, shapeSizeId: number, colorId: number): number | null {
  // A colour in a real price group is priced by that group, full stop: an
  // empty cell there means "not priced yet", not "fall back to the general
  // price", or a category that prices Premium separately would quietly sell
  // Premium at the standard rate wherever its own cell was still blank.
  const groupId = pricing.colorToGroup[colorId] ?? pricing.catchAllGroupId;
  if (groupId === undefined || groupId === null) return null;
  const price = pricing.priceMap[`${shapeId}:${shapeSizeId}:${groupId}`];
  return price === undefined ? null : price;
}

// A saved requirement can span several categories, so pricing is keyed by
// category: a line is only ever priced from its OWN category's price list, and
// a category with no entry here simply prices at null. Passing a single price
// list plus an "active category" used to mean every line from another category
// silently lost its price -- the same basket showed a total on one category
// page and nothing at all on the next.
export type PricingByCategory = Record<number, CategoryPricing | undefined>;

export function cartLinePrice(pricingByCategory: PricingByCategory | undefined,
  item: { orderSpecs?: unknown; categoryId: number; shapeId: number; sizeId: number | null; colorId: number }): number | null {
  if (item.orderSpecs || item.sizeId == null) return null;
  const pricing = pricingByCategory?.[item.categoryId];
  if (!pricing) return null;
  return lineInrPrice(pricing, item.shapeId, item.sizeId, item.colorId);
}
