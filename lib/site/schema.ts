// Every editable piece of website content is described by a small field
// schema. The same schema drives three things: the admin form (so the owner
// only ever sees labelled inputs, never JSON or HTML), server-side cleaning of
// whatever the form sends, and the types the public pages read. Adding a
// field to a page is a one-line change here.
//
// This file must stay free of server-only imports -- the admin editor (a
// client component) imports it too.

import { sanitizeRichText } from './rich-text';

export type Field =
  | { type: 'text'; key: string; label: string; help?: string; max?: number; placeholder?: string }
  | { type: 'textarea'; key: string; label: string; help?: string; max?: number }
  | { type: 'rich'; key: string; label: string; help?: string }
  | { type: 'image'; key: string; label: string; help?: string }
  | { type: 'link'; key: string; label: string; help?: string }
  | { type: 'toggle'; key: string; label: string; help?: string }
  | { type: 'group'; key: string; label: string; help?: string; fields: Field[] }
  | { type: 'list'; key: string; label: string; help?: string; itemLabel: string; fields: Field[]; min?: number; max?: number };

export type Section = { key: string; title: string; help?: string; fields: Field[] };
export type ContentSchema = { sections: Section[] };

export type ContentValue = Record<string, any>;

const DEFAULT_TEXT_MAX = 300;
const DEFAULT_TEXTAREA_MAX = 2000;
const MAX_RICH = 20000;
const MAX_LIST = 50;

function cleanLink(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const v = raw.trim();
  if (!v) return '';
  if (/^\/(?!\/)/.test(v) || /^https?:\/\//i.test(v) || /^(mailto|tel):/i.test(v)) return v.slice(0, 500);
  return '';
}

function cleanField(field: Field, raw: unknown): any {
  switch (field.type) {
    case 'text':
      return typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, field.max ?? DEFAULT_TEXT_MAX) : '';
    case 'textarea':
      return typeof raw === 'string' ? raw.replace(/\r\n/g, '\n').trim().slice(0, field.max ?? DEFAULT_TEXTAREA_MAX) : '';
    case 'rich':
      return typeof raw === 'string' ? sanitizeRichText(raw.slice(0, MAX_RICH * 2)).slice(0, MAX_RICH) : '';
    case 'image': {
      const n = Number(raw);
      return Number.isSafeInteger(n) && n > 0 ? n : null;
    }
    case 'link':
      return cleanLink(raw);
    case 'toggle':
      return raw === true;
    case 'group':
      return cleanFields(field.fields, raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as ContentValue : {});
    case 'list': {
      const items = Array.isArray(raw) ? raw.slice(0, field.max ?? MAX_LIST) : [];
      return items
        .filter((item) => item && typeof item === 'object')
        .map((item) => cleanFields(field.fields, item as ContentValue));
    }
  }
}

function cleanFields(fields: Field[], raw: ContentValue): ContentValue {
  const out: ContentValue = {};
  for (const field of fields) out[field.key] = cleanField(field, raw?.[field.key]);
  return out;
}

/** Keep only the fields the schema knows, each coerced to its type. */
export function cleanContent(schema: ContentSchema, raw: unknown): ContentValue {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as ContentValue : {};
  const out: ContentValue = {};
  for (const section of schema.sections) out[section.key] = cleanFields(section.fields, input[section.key] || {});
  return out;
}

function emptyField(field: Field): any {
  switch (field.type) {
    case 'image': return null;
    case 'toggle': return false;
    case 'group': return emptyFields(field.fields);
    case 'list': return Array.from({ length: field.min ?? 0 }, () => emptyFields(field.fields));
    default: return '';
  }
}
function emptyFields(fields: Field[]): ContentValue {
  return Object.fromEntries(fields.map((f) => [f.key, emptyField(f)]));
}

/** A blank value with every field present, merged under whatever is saved. */
export function withDefaults(schema: ContentSchema, saved: unknown): ContentValue {
  const base: ContentValue = {};
  for (const section of schema.sections) base[section.key] = emptyFields(section.fields);
  const merge = (a: any, b: any): any => {
    if (Array.isArray(a)) return Array.isArray(b) ? b : a;
    if (a && typeof a === 'object') {
      const out = { ...a };
      if (b && typeof b === 'object' && !Array.isArray(b)) for (const k of Object.keys(a)) out[k] = merge(a[k], b[k]);
      return out;
    }
    return b === undefined || b === null ? a : b;
  };
  return merge(base, saved);
}

/** Every media id referenced anywhere in a content value (for previews). */
export function collectImageIds(schema: ContentSchema, value: ContentValue): number[] {
  const ids = new Set<number>();
  const walk = (fields: Field[], v: any) => {
    for (const f of fields) {
      const x = v?.[f.key];
      if (f.type === 'image' && typeof x === 'number') ids.add(x);
      if (f.type === 'group') walk(f.fields, x);
      if (f.type === 'list' && Array.isArray(x)) x.forEach((item) => walk(f.fields, item));
    }
  };
  for (const s of schema.sections) walk(s.fields, value?.[s.key]);
  return [...ids];
}
