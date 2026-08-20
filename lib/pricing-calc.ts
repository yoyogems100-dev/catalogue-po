// Pure pricing lookup -- no imports, safe to use in both server code and the
// browser bundle. Prices are stored per shape+size+color-GROUP (matching the
// supplier sheet's own layout), so pricing an actual line item means first
// resolving its color to a group, then looking up that group's price.
export type CategoryPricing = {
  multiplier: number;
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
  const rmb = lineRmbPrice(pricing, shapeId, shapeSizeId, colorId);
  return rmb === null ? null : rmb * pricing.multiplier;
}
