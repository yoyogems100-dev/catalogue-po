// The admin's "search anything" box: pages, quick actions and categories are
// known to the browser up front; customers, suppliers, shapes, sizes, colours
// and orders come from /api/admin/search as you type. Both are ranked here.
import { BIN, NOTIFICATIONS, OVERVIEW, WORKSPACES, poCategoryPages } from '@/components/admin/nav-config';

export type SearchKind = 'action' | 'page' | 'category' | 'site-category' | 'customer' | 'supplier' | 'shape' | 'size' | 'colour' | 'order';

export type SearchItem = {
  kind: SearchKind;
  label: string;
  /** Second line: where it lives, a phone number, a size's shape... */
  detail?: string;
  href: string;
  /** Extra words that should find this item but are not shown. */
  keywords?: string;
};

export const KIND_LABEL: Record<SearchKind, string> = {
  action: 'Action',
  page: 'Page',
  category: 'Category',
  'site-category': 'Website',
  customer: 'Customer',
  supplier: 'Supplier',
  shape: 'Shape',
  size: 'Size',
  colour: 'Colour',
  order: 'Order'
};

export const QUICK_ACTIONS: SearchItem[] = [
  { kind: 'action', label: 'New customer', href: '/admin/customers?new=1', keywords: 'add create buyer client' },
  { kind: 'action', label: 'Create order', href: '/admin/orders/new', keywords: 'new add requirement purchase' },
  { kind: 'action', label: 'All categories', href: '/admin/categories', keywords: 'catalogue arrange order' }
];

type Cat = { id: number; name: string; parent?: string };

/** Everything findable without asking the server. */
export function staticSearchItems(poCategories: Cat[], siteCategories: Cat[]): SearchItem[] {
  const pages: SearchItem[] = [OVERVIEW, NOTIFICATIONS, BIN, ...WORKSPACES.flatMap((w) =>
    w.groups.flatMap((g) => g.links.map((l) => ({ ...l, where: w.label, group: g.title }))))]
    .map((l: any) => ({
      kind: 'page' as const,
      label: l.label,
      detail: l.where ? `${l.where}${l.group && l.group !== l.label ? ` · ${l.group}` : ''}` : undefined,
      href: l.href,
      keywords: l.detail
    }));
  const categories: SearchItem[] = poCategories.map((c) => ({ kind: 'category', label: c.name, detail: '/po catalogue', href: `/admin/categories/${c.id}` }));
  // "Moissanite pricing" goes straight to that tab.
  const tabs: SearchItem[] = poCategories.flatMap((c) => poCategoryPages(c.id).map((p) => ({
    kind: 'page' as const, label: `${c.name} › ${p.label}`, detail: '/po category page', href: p.href
  })));
  const site: SearchItem[] = siteCategories.map((c) => ({
    kind: 'site-category', label: c.name, detail: c.parent ? `Website · in ${c.parent}` : 'Website', href: `/admin/site/categories/${c.id}`
  }));
  return [...QUICK_ACTIONS, ...pages, ...categories, ...site, ...tabs];
}

export const tokens = (q: string) => q.toLowerCase().split(/[^a-z0-9.#]+/).filter(Boolean);
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9.#]+/).filter(Boolean);

/**
 * How well an item matches, or 0 for no match. Every typed word must start a
 * word somewhere in the item; matches in the name count most, and a name that
 * starts with the whole query beats one that only contains it.
 */
export function scoreItem(item: SearchItem, query: string): number {
  const q = query.trim().toLowerCase();
  const ts = tokens(q);
  if (!ts.length) return 0;
  const label = item.label.toLowerCase();
  const labelWords = words(item.label);
  const otherWords = words(`${item.detail || ''} ${item.keywords || ''}`);
  let score = 0;
  for (const t of ts) {
    if (labelWords.some((w) => w === t)) score += 30;
    else if (labelWords.some((w) => w.startsWith(t))) score += 20;
    else if (label.includes(t)) score += 8;
    else if (otherWords.some((w) => w.startsWith(t))) score += 4;
    else return 0;
  }
  if (label === q) score += 100;
  else if (label.startsWith(q)) score += 50;
  // Short, direct names first: "Customers" before "Customers › something".
  score -= Math.min(label.length, 60) / 20;
  if (item.kind === 'action') score += 6;
  if (item.kind === 'category' || item.kind === 'customer' || item.kind === 'order') score += 3;
  return score;
}

/** The best matches, best first, at most `limit`. */
export function rankItems(items: SearchItem[], query: string, limit = 30): SearchItem[] {
  return items
    .map((item, i) => ({ item, i, score: scoreItem(item, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map((r) => r.item);
}

/** Safe inside a PostgREST or() filter: no commas, brackets or wildcards. */
export function cleanQuery(q: string) {
  return q.replace(/[,()*%\\:"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}
