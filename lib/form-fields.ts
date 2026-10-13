// How a category's order form names and shows its fields, edited on the
// category's Overview tab in admin (a live view of the buyer's form):
// "Shape / Cut" instead of "Shape", or no Size field at all. Stored as one
// JSON map in settings, { categoryId: { labels, hidden } }, so a new category
// needs no migration. The quantity field's name lives with its other settings
// (lib/quantity-field.ts) and Quality is there when the category has
// qualities (lib/qualities.ts).
//
// Every order line needs a shape, colour and size, so one of those can only
// be hidden while the category has a single option for it -- the form then
// picks it without asking. If more options are added later the field comes
// back by itself rather than leave buyers unable to order.

export const FORM_FIELDS_SETTING_KEY = 'category_form_fields';
export const FIELD_LABEL_MAX = 24;

export type FieldKey = 'quality' | 'shape' | 'color' | 'size';
export const LABELLED_FIELDS: FieldKey[] = ['quality', 'shape', 'color', 'size'];
export type HideableField = 'shape' | 'color' | 'size';
export const HIDEABLE_FIELDS: HideableField[] = ['shape', 'color', 'size'];

export type FormFields = { labels: Partial<Record<FieldKey, string>>; hidden: HideableField[] };
export const NO_FORM_FIELDS: FormFields = { labels: {}, hidden: [] };

/** One category's settings from the admin form, or undefined when unusable. */
export function normalizeFormFields(raw: unknown): FormFields | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const labels: FormFields['labels'] = {};
  const rawLabels = (raw as any).labels;
  if (rawLabels != null) {
    if (typeof rawLabels !== 'object' || Array.isArray(rawLabels)) return undefined;
    for (const key of LABELLED_FIELDS) {
      const value = rawLabels[key];
      if (value == null || value === '') continue;
      if (typeof value !== 'string') return undefined;
      const label = value.replace(/\s+/g, ' ').trim();
      if (label.length > FIELD_LABEL_MAX) return undefined;
      if (label) labels[key] = label;
    }
  }
  const rawHidden = (raw as any).hidden;
  if (rawHidden != null && !Array.isArray(rawHidden)) return undefined;
  const hidden = HIDEABLE_FIELDS.filter((key) => (rawHidden || []).includes(key));
  return { labels, hidden };
}

export function parseFormFields(value: string | null | undefined): Record<number, FormFields> {
  const out: Record<number, FormFields> = {};
  if (!value) return out;
  let raw: unknown;
  try { raw = JSON.parse(value); } catch { return out; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, entry] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number(key);
    const fields = normalizeFormFields(entry);
    if (Number.isSafeInteger(id) && id > 0 && fields) out[id] = fields;
  }
  return out;
}

export function formFieldsFor(all: Record<number, FormFields> | null | undefined, categoryId: number): FormFields {
  return all?.[categoryId] ?? NO_FORM_FIELDS;
}

/** Hidden in the buyer's form: asked to be, and there's just one to pick. */
export function fieldHidden(fields: FormFields | null | undefined, key: HideableField, optionCount: number): boolean {
  return !!fields?.hidden.includes(key) && optionCount === 1;
}
