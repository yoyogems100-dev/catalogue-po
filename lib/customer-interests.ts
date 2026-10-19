// "Curated for you": categories the team picks for one buyer from their
// go-to requirements (customers.interest_category_ids, in shelf order). When
// customers.show_interests is on and at least one live category is picked,
// the buyer's /po home page opens with this shelf above the shop's own.
import type { HomeSection, HomeSections } from './home-sections';

export const MAX_INTERESTS = 24;

export const FOR_YOU_TITLE = 'Curated for you';
export const FOR_YOU_SUBTITLE = 'Selected for your go-to requirements';

/** Positive whole numbers, duplicates dropped, first pick wins, capped. */
export function sanitizeInterestIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  for (const raw of value) {
    const n = Number(raw);
    if (Number.isSafeInteger(n) && n > 0 && !out.includes(n)) out.push(n);
    if (out.length >= MAX_INTERESTS) break;
  }
  return out;
}

export function forYouSection(categoryIds: number[]): HomeSection {
  return { key: 'for-you', title: FOR_YOU_TITLE, subtitle: FOR_YOU_SUBTITLE, cardLabel: 'For you', visible: true, categoryIds };
}

/** The shop's shelves with this buyer's own shelf first, when they have one. */
export function withInterests(config: HomeSections, interests: { ids: number[]; show: boolean } | null): HomeSections {
  if (!interests || !interests.show || interests.ids.length === 0) return config;
  return { ...config, sections: [forYouSection(interests.ids), ...config.sections] };
}

/**
 * The buyer's own star on a /po category card: starring adds the category to
 * the end of their shelf, un-starring takes it off. Null when the shelf is
 * already full.
 */
export function toggleInterest(ids: number[], categoryId: number, starred: boolean): number[] | null {
  const without = ids.filter((id) => id !== categoryId);
  if (!starred) return without;
  if (ids.includes(categoryId)) return ids;
  return without.length >= MAX_INTERESTS ? null : [...without, categoryId];
}
