// The category shelves on the /po home page ("Most ordered", "New in", ...),
// set up from Admin > /po page setup > Home page sections.
//
// Stored as JSON in settings under HOME_SECTIONS_SETTING_KEY: the shelves in
// display order, each with the category IDs it shows in order. Every category
// in no visible shelf follows below them under `restTitle`. Until the owner
// saves the new setup, the page builds it from the older single "Most
// ordered" list, so nothing changes on the live page until then.
import { parseMostOrdered } from './most-ordered';

export const HOME_SECTIONS_SETTING_KEY = 'home_category_sections';

export type HomeSection = {
  /** Stable key for React and for the editor; never shown. */
  key: string;
  title: string;
  /** Small line beside the title, e.g. "Our buyers' top picks". */
  subtitle: string;
  /** Tag on the card when it turns up in search results, e.g. "New". Empty for none. */
  cardLabel: string;
  visible: boolean;
  categoryIds: number[];
};

export type HomeSections = { sections: HomeSection[]; restTitle: string };

export const DEFAULT_REST_TITLE = 'More categories';

const ids = (value: unknown): number[] =>
  Array.isArray(value)
    ? [...new Set(value.map(Number).filter((n) => Number.isSafeInteger(n) && n > 0))]
    : [];

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export function mostOrderedSection(categoryIds: number[]): HomeSection {
  return { key: 'most-ordered', title: 'Most ordered', subtitle: 'Our buyers’ top picks', cardLabel: 'Most ordered', visible: true, categoryIds };
}

export function newSection(title = 'New in'): HomeSection {
  const key = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return { key, title, subtitle: title === 'New in' ? 'Just added to the catalogue' : '', cardLabel: title === 'New in' ? 'New' : '', visible: true, categoryIds: [] };
}

/** Read the saved setup; falls back to the older "Most ordered" list when nothing is saved yet. */
export function parseHomeSections(value: string | null | undefined, legacyMostOrdered?: string | null): HomeSections {
  let raw: any = null;
  if (value) { try { raw = JSON.parse(value); } catch { raw = null; } }
  if (!raw || !Array.isArray(raw.sections)) {
    const legacy = parseMostOrdered(legacyMostOrdered);
    return { sections: legacy.length ? [mostOrderedSection(legacy)] : [], restTitle: DEFAULT_REST_TITLE };
  }
  const seen = new Set<string>();
  const sections: HomeSection[] = [];
  for (const s of raw.sections) {
    if (!s || typeof s !== 'object') continue;
    let key = text(s.key, 40) || `s${sections.length}`;
    while (seen.has(key)) key += '_';
    seen.add(key);
    sections.push({
      key,
      title: text(s.title, 60) || 'Untitled section',
      subtitle: text(s.subtitle, 80),
      cardLabel: text(s.cardLabel, 20),
      visible: s.visible !== false,
      categoryIds: ids(s.categoryIds)
    });
  }
  return { sections, restTitle: text(raw.restTitle, 60) || DEFAULT_REST_TITLE };
}

export function serializeHomeSections(value: HomeSections): string {
  return JSON.stringify({
    restTitle: value.restTitle.trim() || DEFAULT_REST_TITLE,
    sections: value.sections.map((s) => ({
      key: s.key,
      title: s.title.trim() || 'Untitled section',
      subtitle: s.subtitle.trim(),
      cardLabel: s.cardLabel.trim(),
      visible: s.visible,
      categoryIds: ids(s.categoryIds)
    }))
  });
}

/**
 * What the home page shows with no search or filter: each visible shelf with
 * the categories that still exist (an archived or deleted category drops out),
 * then every category in no visible shelf. A category may sit on more than one
 * shelf (e.g. both "New in" and "Most ordered").
 */
export function layoutHomeSections<C extends { id: number }>(config: HomeSections, categories: C[]) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const shelves = config.sections
    .filter((s) => s.visible)
    .map((s) => ({ ...s, categories: s.categoryIds.map((id) => byId.get(id)).filter((c): c is C => !!c) }))
    .filter((s) => s.categories.length > 0);
  const shelved = new Set(shelves.flatMap((s) => s.categories.map((c) => c.id)));
  return { shelves, rest: categories.filter((c) => !shelved.has(c.id)) };
}
