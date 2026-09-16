import { NextRequest, NextResponse } from 'next/server';
import { getCategoryPricing } from '@/lib/pricing';

// Public customer-facing price lookup for one or more categories.
//
// A saved cart can span several categories, but a category page only ever
// server-renders its own price list, so every line from a different category
// showed no price and dropped out of the estimated total. This lets the cart
// fill in the rest.
//
// It returns only what the catalogue already exposes publicly -- the colour ->
// price-group map and the customer-facing INR price per shape/size/group, read
// through the anon client and its public read policies. Supplier and cost
// prices are never part of CategoryPricing and are not reachable from here.

const MAX_CATEGORIES = 25;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('ids') || '';
  const ids = Array.from(new Set(
    raw.split(',').map((part) => Number(part.trim())).filter((n) => Number.isInteger(n) && n > 0)
  )).slice(0, MAX_CATEGORIES);

  if (!ids.length) return NextResponse.json({ pricing: {} });

  const results = await Promise.all(ids.map(async (id) => [id, await getCategoryPricing(id)] as const));
  const pricing: Record<number, unknown> = {};
  results.forEach(([id, value]) => { pricing[id] = value; });

  return NextResponse.json({ pricing }, {
    // Catalogue prices change rarely and are identical for every customer.
    headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=300' }
  });
}
