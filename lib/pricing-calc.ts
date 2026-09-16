// Pure pricing lookup -- no imports, safe to use in both server code and the
// browser bundle. Prices are stored per shape+size+color-GROUP (matching the
// supplier sheet's own layout), so pricing an actual line item means first
// resolving its color to a group, then looking up that group's price.
export type CategoryPricing = {
  colorToGroup: Record<number, number>;
  priceMap: Record<string, number>; // `${shapeId}:${shapeSizeId}:${groupId}` -> price in INR
};

export function lineInrPrice(pricing: CategoryPricing, shapeId: number, shapeSizeId: number, colorId: number): number | null {
  const groupId = pricing.colorToGroup[colorId];
  if (groupId === undefined) return null;
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
