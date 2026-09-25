// Category-page filters: Shape · Size · Colour · Grade. Filters live in the
// URL (?colour=green,blue&shape=oval) so every filtered view is a real,
// shareable, indexable page. Pure functions only -- used by the server page,
// the client filter bar and tests.

export type Dimension = 'shape' | 'size' | 'colour' | 'grade';
export const DIMENSIONS: Dimension[] = ['shape', 'size', 'colour', 'grade'];
export type Selection = Record<Dimension, string[]>;
export type OptionLike = { slug: string; name: string };
export type OptionsByDim = Record<Dimension, OptionLike[]>;

export function slugOf(text: string): string {
  return (text || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Size filter works on mm ranges, by the stone's largest dimension. */
export const SIZE_BUCKETS = [
  { slug: 'under-2mm', label: 'Under 2mm', min: 0, max: 2 },
  { slug: '2-4mm', label: '2–4mm', min: 2, max: 4 },
  { slug: '4-6mm', label: '4–6mm', min: 4, max: 6 },
  { slug: '6-10mm', label: '6–10mm', min: 6, max: 10 },
  { slug: '10mm-plus', label: '10mm and up', min: 10, max: Infinity }
] as const;

export function sizeBucketOf(sizeMm: string | null | undefined): string | null {
  const nums = String(sizeMm || '').match(/\d+(?:\.\d+)?/g)?.map(Number).filter((n) => n > 0) || [];
  if (!nums.length) return null;
  const largest = Math.max(...nums);
  return SIZE_BUCKETS.find((b) => largest >= b.min && largest < b.max)?.slug ?? null;
}

/**
 * Colour families: a plain colour word in the URL (?colour=green) stands for
 * every colour on the page whose name contains it (Emerald Green, Apple
 * Green, Mint Green...). Lets simple links like the footer's "Green Nano"
 * work without the owner having to name exact shades.
 */
export const COLOUR_FAMILIES = ['white', 'black', 'red', 'pink', 'orange', 'yellow', 'green', 'blue', 'purple', 'violet', 'brown', 'grey', 'champagne', 'gold', 'peach', 'lavender'] as const;

export function familyMembers(family: string, options: OptionLike[]): OptionLike[] {
  if (!(COLOUR_FAMILIES as readonly string[]).includes(family)) return [];
  return options.filter((o) => o.slug.split('-').includes(family));
}

/** Read the URL; keep only values that exist on this page, in option order. */
export function parseSelection(params: Record<string, string | string[] | undefined>, options: OptionsByDim): Selection {
  const out = {} as Selection;
  for (const dim of DIMENSIONS) {
    const raw = params[dim];
    const values = new Set((Array.isArray(raw) ? raw.join(',') : raw || '').split(',').map((v) => slugOf(v)).filter(Boolean));
    const exact = options[dim].filter((o) => values.has(o.slug)).map((o) => o.slug);
    const families = dim === 'colour'
      ? [...values].filter((v) => !exact.includes(v) && familyMembers(v, options.colour).length > 0 && !options.colour.some((o) => o.slug === v))
      : [];
    out[dim] = [...families, ...exact];
  }
  return out;
}

/** Display name for a selected value, including colour families. */
export function valueName(dim: Dimension, value: string, options: OptionsByDim): string | undefined {
  return options[dim].find((o) => o.slug === value)?.name
    ?? (dim === 'colour' && (COLOUR_FAMILIES as readonly string[]).includes(value) ? value[0].toUpperCase() + value.slice(1) : undefined);
}

export function activeCount(sel: Selection) {
  return DIMENSIONS.reduce((n, d) => n + sel[d].length, 0);
}

/** URL for this page with one value toggled (or a dimension cleared). */
export function filterHref(basePath: string, sel: Selection, dim?: Dimension, value?: string, clear = false): string {
  const next: Selection = { shape: [...sel.shape], size: [...sel.size], colour: [...sel.colour], grade: [...sel.grade] };
  if (dim && clear) next[dim] = [];
  else if (dim && value) next[dim] = next[dim].includes(value) ? next[dim].filter((v) => v !== value) : [...next[dim], value];
  const qs = DIMENSIONS.filter((d) => next[d].length).map((d) => `${d}=${next[d].map(encodeURIComponent).join(',')}`).join('&');
  return qs ? `${basePath}?${qs}` : basePath;
}

export type Taggable = { shapes: string[]; colours: string[]; sizes: string[]; grade: string | null };

/** Within a dimension values are OR; across dimensions they are AND. */
export function matches(item: Taggable, sel: Selection): boolean {
  if (sel.shape.length && !item.shapes.some((v) => sel.shape.includes(v))) return false;
  if (sel.colour.length && !item.colours.some((v) => sel.colour.some((want) => v === want || v.split('-').includes(want)))) return false;
  if (sel.size.length && !item.sizes.some((v) => sel.size.includes(v))) return false;
  if (sel.grade.length && !(item.grade && sel.grade.includes(item.grade))) return false;
  return true;
}

/** "5A Green Oval 2–4mm": the words a filtered page is titled with. */
export function selectionWords(sel: Selection, options: OptionsByDim): string {
  const names = (dim: Dimension) => sel[dim].map((v) => valueName(dim, v, options)).filter(Boolean) as string[];
  const join = (list: string[]) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} & ${list[list.length - 1]}` : list[0] || '');
  return [join(names('grade')), join(names('colour')), join(names('shape')), join(names('size'))].filter(Boolean).join(' ');
}

export function fillTemplate(template: string, words: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => words[k] ?? '').replace(/\s+/g, ' ').replace(/\s+([,.])/g, '$1').trim();
}

/**
 * Index simple filtered views (one value in up to two dimensions) as pages
 * of their own; point deeper combinations at the unfiltered page so search
 * engines are not handed thousands of near-duplicates.
 */
export function isIndexable(sel: Selection): boolean {
  const used = DIMENSIONS.filter((d) => sel[d].length);
  return used.length <= 2 && used.every((d) => sel[d].length === 1);
}
