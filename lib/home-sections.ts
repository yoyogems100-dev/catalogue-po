// The category sections on the /po home page ("White Round", "Ruby", "New
// in", ...), set up from Admin > /po page setup > Home page sections.
//
// Each section is shown one of two ways: as a shelf of cards on the home page,
// or only as a small tag on its cards ("Most ordered"). Sections can also be
// groups in the /po category menu, each with one category's gemstone icon.
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
  /**
   * Tag on the card, e.g. "New". A shelf's cards carry it only in search
   * results (the heading already says it); a tag-only section's cards carry it
   * everywhere. Empty for none.
   */
  cardLabel: string;
  /** Switched on. Off hides it everywhere: home page, tags and menu. */
  visible: boolean;
  categoryIds: number[];
  /** 'shelf' (default): its own row of cards. 'tag': no row, just the card tag. */
  display?: SectionDisplay;
  /** A group in the /po category menu. Defaults to on for shelves. */
  inMenu?: boolean;
  /** The category whose gemstone icon stands for this group in the menu; first with one when unset. */
  iconCategoryId?: number | null;
};

export type SectionDisplay = 'shelf' | 'tag';

export type HomeSections = {
  sections: HomeSection[];
  restTitle: string;
  /** The last list shows every category (default), or only those on no shelf. */
  restShowsAll?: boolean;
};

export const DEFAULT_REST_TITLE = 'All categories';
/** What the last list was called before; read as the new default. */
const OLD_DEFAULT_REST_TITLE = 'More categories';

export const sectionDisplay = (s: HomeSection): SectionDisplay => (s.display === 'tag' ? 'tag' : 'shelf');
export const sectionInMenu = (s: HomeSection): boolean => s.inMenu ?? sectionDisplay(s) === 'shelf';

const ids = (value: unknown): number[] =>
  Array.isArray(value)
    ? [...new Set(value.map(Number).filter((n) => Number.isSafeInteger(n) && n > 0))]
    : [];

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export function mostOrderedSection(categoryIds: number[]): HomeSection {
  return { key: 'most-ordered', title: 'Most ordered', subtitle: 'Our buyers’ top picks', cardLabel: 'Most ordered', visible: true, categoryIds, display: 'tag', inMenu: false, iconCategoryId: null };
}

export function newSection(title = 'New in'): HomeSection {
  const key = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return { key, title, subtitle: title === 'New in' ? 'Just added to the catalogue' : '', cardLabel: title === 'New in' ? 'New' : '', visible: true, categoryIds: [], display: 'shelf', inMenu: true, iconCategoryId: null };
}

/** Read the saved setup; falls back to the older "Most ordered" list when nothing is saved yet. */
export function parseHomeSections(value: string | null | undefined, legacyMostOrdered?: string | null): HomeSections {
  let raw: any = null;
  if (value) { try { raw = JSON.parse(value); } catch { raw = null; } }
  if (!raw || !Array.isArray(raw.sections)) {
    const legacy = parseMostOrdered(legacyMostOrdered);
    return { sections: legacy.length ? [mostOrderedSection(legacy)] : [], restTitle: DEFAULT_REST_TITLE, restShowsAll: true };
  }
  const seen = new Set<string>();
  const sections: HomeSection[] = [];
  for (const s of raw.sections) {
    if (!s || typeof s !== 'object') continue;
    let key = text(s.key, 40) || `s${sections.length}`;
    while (seen.has(key)) key += '_';
    seen.add(key);
    // "Most ordered" was a shelf until sections could be tag-only; saved
    // before then, it becomes a tag on its cards.
    const display: SectionDisplay = s.display === 'tag' || s.display === 'shelf' ? s.display : key === 'most-ordered' ? 'tag' : 'shelf';
    const icon = Number(s.iconCategoryId);
    sections.push({
      key,
      title: text(s.title, 60) || 'Untitled section',
      subtitle: text(s.subtitle, 80),
      cardLabel: text(s.cardLabel, 20),
      visible: s.visible !== false,
      categoryIds: ids(s.categoryIds),
      display,
      inMenu: typeof s.inMenu === 'boolean' ? s.inMenu : display === 'shelf',
      iconCategoryId: Number.isSafeInteger(icon) && icon > 0 ? icon : null
    });
  }
  const restTitle = text(raw.restTitle, 60);
  return {
    sections,
    restTitle: !restTitle || restTitle === OLD_DEFAULT_REST_TITLE ? DEFAULT_REST_TITLE : restTitle,
    restShowsAll: raw.restShowsAll !== false
  };
}

export function serializeHomeSections(value: HomeSections): string {
  return JSON.stringify({
    restTitle: value.restTitle.trim() || DEFAULT_REST_TITLE,
    restShowsAll: value.restShowsAll !== false,
    sections: value.sections.map((s) => ({
      key: s.key,
      title: s.title.trim() || 'Untitled section',
      subtitle: s.subtitle.trim(),
      cardLabel: s.cardLabel.trim(),
      visible: s.visible,
      categoryIds: ids(s.categoryIds),
      display: sectionDisplay(s),
      inMenu: sectionInMenu(s),
      iconCategoryId: s.iconCategoryId ?? null
    }))
  });
}

/**
 * What the home page shows with no search or filter: each visible shelf with
 * the categories that still exist (an archived or deleted category drops out),
 * then the last list -- every category, or only those on no shelf. A category
 * may sit on more than one shelf. Tag-only sections add no shelf; `tags` is
 * the tag each of their categories carries everywhere (first section wins).
 */
export function layoutHomeSections<C extends { id: number }>(config: HomeSections, categories: C[]) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const live = config.sections
    .filter((s) => s.visible)
    .map((s) => ({ ...s, categories: s.categoryIds.map((id) => byId.get(id)).filter((c): c is C => !!c) }))
    .filter((s) => s.categories.length > 0);
  const shelves = live.filter((s) => sectionDisplay(s) === 'shelf');
  const tags = new Map<number, string>();
  live.filter((s) => sectionDisplay(s) === 'tag').forEach((s) => {
    const label = s.cardLabel || s.title;
    s.categories.forEach((c) => { if (!tags.has(c.id)) tags.set(c.id, label); });
  });
  const shelved = new Set(shelves.flatMap((s) => s.categories.map((c) => c.id)));
  const rest = config.restShowsAll === false ? categories.filter((c) => !shelved.has(c.id)) : categories;
  return { shelves, rest, tags };
}

export type MenuGroup<C> = { key: string; title: string; icon: C | null; categories: C[] };

/**
 * The /po category menu: one group per switched-on section marked for the
 * menu, in section order, with the categories that still exist. `icon` is the
 * category whose gemstone picture stands for the group -- the chosen one, else
 * the first that has a picture.
 */
export function menuGroups<C extends { id: number }>(config: HomeSections, categories: C[], hasIcon: (c: C) => boolean): MenuGroup<C>[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return config.sections
    .filter((s) => s.visible && sectionInMenu(s))
    .map((s) => {
      const list = s.categoryIds.map((id) => byId.get(id)).filter((c): c is C => !!c);
      const chosen = s.iconCategoryId ? byId.get(s.iconCategoryId) : undefined;
      const icon = (chosen && hasIcon(chosen) ? chosen : list.find(hasIcon)) ?? null;
      return { key: s.key, title: s.title, icon, categories: list };
    })
    .filter((g) => g.categories.length > 0);
}
