import { normalizePhone } from '@/lib/phone';

// Catalogue requests from the public form: validation, spam checks, the
// WhatsApp reply draft and the CSV export. Pure functions, so they are tested
// without a database. Nothing here sends a message: the owner replies by hand.

export const LEAD_STATUSES = ['new', 'sent', 'closed'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const STATUS_LABEL: Record<LeadStatus, string> = { new: 'New', sent: 'Sent', closed: 'Closed' };

export type Lead = {
  id: number;
  name: string;
  business_city: string;
  whatsapp: string;
  category_names: string[];
  monthly_requirement: string;
  status: LeadStatus;
  notes: string;
  source_path: string | null;
  created_at: string;
};

export type CategoryChoice = { id: number; name: string };

export const LIMITS = { name: 80, business: 120, requirement: 300, notes: 2000, categories: 30 };

/** Spam rules: at most this many requests per visitor (hashed IP) per window,
 *  and a site-wide ceiling so a flood from many addresses still stops. */
export const RATE = { perVisitor: 3, siteWide: 40, windowMinutes: 30, minFillMs: 2500 };

const oneLine = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Digits only, with an Indian mobile shortened to its 10-digit form. */
export function cleanWhatsapp(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 30 || /[a-z]/i.test(raw)) return null;
  const n = normalizePhone(raw);
  // 10-digit Indian mobile, or a full international number (8–15 digits).
  if (/^[6-9]\d{9}$/.test(n)) return n;
  if (n.length >= 8 && n.length <= 15 && !n.startsWith('0') && raw.trim().startsWith('+')) return n;
  return null;
}

export type LeadInput = {
  name: string;
  business_city: string;
  whatsapp: string;
  category_ids: number[];
  category_names: string[];
  monthly_requirement: string;
  source_path: string | null;
};

export type LeadCheck =
  | { ok: true; lead: LeadInput }
  | { ok: false; error: string; field?: string }
  | { ok: false; spam: true };

/**
 * Validate a submitted form against the live category list. A filled honeypot
 * or a form sent back faster than a person could type is reported as spam, so
 * the route can answer "thanks" without storing anything.
 */
export function checkLead(body: Record<string, any> | null, choices: CategoryChoice[], now = Date.now()): LeadCheck {
  if (!body) return { ok: false, error: 'Something went wrong -- please try again.' };
  if (oneLine(body.company_website, 200)) return { ok: false, spam: true };
  const started = Number(body.started_at);
  if (Number.isFinite(started) && started > 0 && now - started < RATE.minFillMs) return { ok: false, spam: true };

  const name = oneLine(body.name, LIMITS.name);
  if (name.length < 2) return { ok: false, error: 'Please enter your name.', field: 'name' };
  const business_city = oneLine(body.business_city, LIMITS.business);
  if (business_city.length < 2) return { ok: false, error: 'Please enter your business name and city.', field: 'business_city' };
  const whatsapp = cleanWhatsapp(body.whatsapp);
  if (!whatsapp) return { ok: false, error: 'Please enter a WhatsApp number we can reach, e.g. 98765 43210 or +971 50 123 4567.', field: 'whatsapp' };

  const byId = new Map(choices.map((c) => [c.id, c]));
  const picked = Array.isArray(body.category_ids) ? body.category_ids.slice(0, LIMITS.categories) : [];
  const categories = [...new Set(picked.map(Number))].map((id) => byId.get(id as number)).filter((c): c is CategoryChoice => !!c);

  const path = typeof body.source_path === 'string' && /^\/[\w\-/?=&%.,]*$/.test(body.source_path) ? body.source_path.slice(0, 200) : null;

  return {
    ok: true,
    lead: {
      name, business_city, whatsapp,
      category_ids: categories.map((c) => c.id),
      category_names: categories.map((c) => c.name),
      monthly_requirement: oneLine(body.monthly_requirement, LIMITS.requirement),
      source_path: path
    }
  };
}

/** Whether another request from this visitor, or from anyone, is allowed now. */
export function rateAllows(recentFromVisitor: number, recentSiteWide: number) {
  return recentFromVisitor < RATE.perVisitor && recentSiteWide < RATE.siteWide;
}

/** The number in the form wa.me expects: country code, no plus. */
export function waNumber(whatsapp: string) {
  return /^[6-9]\d{9}$/.test(whatsapp) ? `91${whatsapp}` : whatsapp;
}

/** Readable number for the admin table. */
export function displayWhatsapp(whatsapp: string) {
  return /^[6-9]\d{9}$/.test(whatsapp) ? `+91 ${whatsapp.slice(0, 5)} ${whatsapp.slice(5)}` : `+${whatsapp}`;
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

/** Fill the owner's reply template: {name}, {first_name}, {business}, {categories}, {link}. */
export function replyText(template: string, lead: Pick<Lead, 'name' | 'business_city' | 'category_names'>, link: string) {
  const values: Record<string, string> = {
    name: lead.name, first_name: firstName(lead.name), business: lead.business_city,
    categories: lead.category_names.join(', ') || 'our full range', link
  };
  // No catalogue link saved yet: leave out the line that would carry it.
  const text = link ? template : template.split('\n').filter((l) => !l.includes('{link}')).join('\n');
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in values ? values[k] : m)).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function replyHref(template: string, lead: Pick<Lead, 'name' | 'business_city' | 'category_names' | 'whatsapp'>, link: string) {
  return `https://wa.me/${waNumber(lead.whatsapp)}?text=${encodeURIComponent(replyText(template, lead, link))}`;
}

// A cell starting with = + - @ is run as a formula by Excel; prefix it so a
// typed-in value can never execute when the owner opens the export.
function csvCell(v: unknown) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function leadsCsv(leads: Lead[]) {
  const head = ['Date', 'Name', 'Business & city', 'WhatsApp', 'Categories', 'Monthly requirement', 'Status', 'Notes', 'Sent from'];
  const rows = leads.map((l) => [
    new Date(l.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }),
    l.name, l.business_city, displayWhatsapp(l.whatsapp).slice(1), l.category_names.join('; '), // number without + (Excel reads + as a formula)
    l.monthly_requirement, STATUS_LABEL[l.status] ?? l.status, l.notes, l.source_path ?? ''
  ]);
  // BOM so Excel reads the file as UTF-8 (₹, names in Hindi).
  return '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export type ReplySettings = { catalogue_link: string; message: string };
export const DEFAULT_REPLY: ReplySettings = {
  catalogue_link: '',
  message: 'Hi {first_name}, thank you for your catalogue request to YOYO GEMS.\n\nHere is our digital catalogue: {link}\n\nSend us the shapes, sizes, colours and quantities you need and we will confirm stock and price.'
};

/** The owner's reply settings, or null with a reason if they are not usable. */
export function cleanReply(raw: Record<string, any> | null): { value: ReplySettings } | { error: string } {
  const link = typeof raw?.catalogue_link === 'string' ? raw.catalogue_link.trim() : '';
  if (link && (!/^https:\/\/[^\s]+$/i.test(link) || link.length > 500)) return { error: 'The catalogue link must be a full web address starting with https://' };
  const message = typeof raw?.message === 'string' ? raw.message.replace(/\r\n/g, '\n').trim().slice(0, 1000) : '';
  if (!message) return { error: 'Write the reply message first.' };
  return { value: { catalogue_link: link, message } };
}
