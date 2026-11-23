// These are the seven values the database's own `orders_status_check`
// constraint allows, in order. Keep this list in sync with that constraint:
// anything missing here cannot be set from admin, renders as a raw lowercase
// key wherever a label is shown (including the customer's PDF), and -- worst --
// makes milestoneIndex() return -1, so the status dropdown silently falls back
// to "Placed" on an order that is actually further along.
//
// The keys never change. What admin edits (Orders > Stages & messages) is the
// name each key shows as, whether it's offered at all, and the WhatsApp
// message sent for it -- stored as JSON in settings.order_stages. The labels
// below are the defaults used when nothing is saved.
export const ORDER_MILESTONES = [
  { key: 'placed', label: 'Order placed' },
  { key: 'confirmed', label: 'Order received' },
  { key: 'sourcing', label: 'Confirmed by supplier' },
  { key: 'quality_check', label: 'Dispatched from China' },
  { key: 'packed', label: 'Goods received in Jaipur' },
  { key: 'shipped', label: 'Parcel sent' },
  { key: 'delivered', label: 'Delivered' }
];

export const CANCELLED_STATUS = { key: 'cancelled', label: 'Cancelled' };

export const ORDER_STATUS_OPTIONS = [...ORDER_MILESTONES, CANCELLED_STATUS];

export const ORDER_STAGES_SETTING_KEY = 'order_stages';

export type OrderStage = {
  key: string;
  label: string;
  /** WhatsApp message with {placeholders}; see STAGE_PLACEHOLDERS. */
  message: string;
  /** Hidden stages aren't offered in admin or shown on the buyer's tracker. */
  hidden: boolean;
};

export const STAGE_PLACEHOLDERS: { token: string; meaning: string }[] = [
  { token: '{name}', meaning: "Buyer's name" },
  { token: '{order}', meaning: 'Order number' },
  { token: '{stage}', meaning: 'Stage name' },
  { token: '{link}', meaning: 'Link to the order on the website' },
  { token: '{login}', meaning: "Buyer's WhatsApp number (their login)" },
  { token: '{pin}', meaning: "Buyer's login PIN" },
  { token: '{pdf}', meaning: 'Order PDF link, once generated' },
  { token: '{courier}', meaning: 'Courier chosen on the order' }
];

// Every message: "Hi {name}," on its own line, the news with the key words in
// WhatsApp *bold*, then what the buyer will hear about next. [square brackets]
// drop their words while a placeholder inside is empty (no courier yet).
const greet = (news: string, ...rest: string[]) => ['Hi {name},', `Your YOYO GEMS *Order #{order}* ${news}`, ...rest].join('\n');
const LOGIN_LINES = ['', 'You can view your order and explore more using this link:', '{link}', '', 'Login: {login}', 'PIN: {pin}'];

const DEFAULT_MESSAGES: Record<string, string> = {
  placed: greet('has been *Placed*.', ...LOGIN_LINES, '', "We'll notify you once your order is *Received* by our team."),
  confirmed: greet('has been *Received*.', '', "We'll notify you once it is *Confirmed by the supplier*."),
  sourcing: greet('has been *Confirmed by the supplier* and is being prepared in China.', '', "We'll notify you once it is *Dispatched from China*."),
  quality_check: greet('has been *Dispatched from China*.', '', "We'll notify you once it is *Received in Jaipur*."),
  packed: greet('has been *Received in Jaipur*.', '', "We'll notify you once your parcel is *Sent*[ via *{courier}*]."),
  shipped: greet('has been *Sent*[ via *{courier}*].', '', 'You can view your order here:', '{link}'),
  delivered: greet('has been *Delivered*.', '', 'Thank you for ordering with YOYO GEMS.'),
  cancelled: greet('has been *Cancelled*.', '', 'For any questions, just reply to this message.')
};

// The owner's stage list stops at "Parcel sent", so Delivered starts hidden.
const DEFAULT_HIDDEN = new Set(['delivered']);

export const DEFAULT_ORDER_STAGES: OrderStage[] = ORDER_STATUS_OPTIONS.map((m) => ({
  key: m.key,
  label: m.label,
  message: DEFAULT_MESSAGES[m.key] || '',
  hidden: DEFAULT_HIDDEN.has(m.key)
}));

// Orders sent straight from Jaipur stock skip the China steps: only
// placed -> Order received -> Dispatched from Jaipur (Delivered/Cancelled as
// usual). Same status keys, own names and messages, saved separately.
export const JAIPUR_STAGES_SETTING_KEY = 'order_stages_jaipur';
export const JAIPUR_SKIPPED = new Set(['sourcing', 'quality_check', 'packed']);
const JAIPUR_OVERRIDES: Record<string, { label: string; message: string }> = {
  // Jaipur stock usually goes out the same day, so the first message can
  // already name the courier.
  placed: {
    label: 'Order placed',
    message: greet('has been *Placed*[ and *Dispatched* via *{courier}*].', ...LOGIN_LINES)
  },
  confirmed: {
    label: 'Order received',
    message: greet('has been *Received* and is being prepared.', '', "We'll notify you once it is *Dispatched*[ via *{courier}*].")
  },
  shipped: {
    label: 'Dispatched from Jaipur',
    message: greet('has been *Dispatched* from Jaipur[ via *{courier}*].', '', 'You can view your order here:', '{link}')
  }
};
export const DEFAULT_JAIPUR_STAGES: OrderStage[] = DEFAULT_ORDER_STAGES.map((s) => ({
  ...s,
  ...(JAIPUR_OVERRIDES[s.key] || {}),
  hidden: s.hidden || JAIPUR_SKIPPED.has(s.key)
}));

export const MAX_STAGE_LABEL = 60;
export const MAX_STAGE_MESSAGE = 1500;

/**
 * Saved JSON -> full stage list, always all eight keys in fixed order. Bad or
 * partial data falls back per field, so a broken save can never leave a status
 * without a name. Cancelled can't be hidden (it isn't a step).
 */
export function resolveOrderStages(raw: unknown, defaults: OrderStage[] = DEFAULT_ORDER_STAGES): OrderStage[] {
  const jaipur = defaults === DEFAULT_JAIPUR_STAGES;
  let saved: unknown = raw;
  if (typeof raw === 'string') {
    try { saved = JSON.parse(raw); } catch { saved = null; }
  }
  const byKey = new Map<string, Record<string, unknown>>();
  if (Array.isArray(saved)) {
    for (const s of saved) {
      if (s && typeof s === 'object' && typeof (s as any).key === 'string') byKey.set((s as any).key, s as Record<string, unknown>);
    }
  }
  return defaults.map((d) => {
    // The China steps can't be switched on for a Jaipur dispatch.
    if (jaipur && JAIPUR_SKIPPED.has(d.key)) return { ...d };
    const s = byKey.get(d.key);
    if (!s) return { ...d };
    const label = typeof s.label === 'string' && s.label.trim() ? s.label.trim().slice(0, MAX_STAGE_LABEL) : d.label;
    const message = typeof s.message === 'string' ? s.message.slice(0, MAX_STAGE_MESSAGE) : d.message;
    const hidden = d.key === CANCELLED_STATUS.key ? false : s.hidden === true;
    return { key: d.key, label, message, hidden };
  });
}

/** Steps only (no Cancelled), in order, hidden ones removed unless `keep` is one. */
export function visibleMilestones(stages: OrderStage[], keep?: string) {
  return stages.filter((s) => s.key !== CANCELLED_STATUS.key && (!s.hidden || s.key === keep));
}

/** What a status dropdown should offer: visible steps, the current one, and Cancelled. */
export function statusChoices(stages: OrderStage[], current?: string) {
  return stages.filter((s) => !s.hidden || s.key === current);
}

export function milestoneIndex(status: string) {
  return ORDER_MILESTONES.findIndex((m) => m.key === status);
}

export function resolveJaipurStages(raw: unknown): OrderStage[] {
  return resolveOrderStages(raw, DEFAULT_JAIPUR_STAGES);
}

/** The stage list an order follows: Jaipur dispatch or the usual China route. */
export function stagesFor(sets: { china: OrderStage[]; jaipur: OrderStage[] }, fromJaipur: boolean | null | undefined) {
  return fromJaipur ? sets.jaipur : sets.china;
}

export function milestoneLabel(status: string, stages?: OrderStage[]) {
  return (stages || DEFAULT_ORDER_STAGES).find((m) => m.key === status)?.label || status;
}

export type StageMessageValues = {
  name?: string | null;
  order: number | string;
  link?: string | null;
  login?: string | null;
  pin?: string | null;
  pdf?: string | null;
  courier?: string | null;
};

/**
 * Fills a stage's message. A line whose placeholders are all empty (say the
 * buyer has no PIN yet, or no PDF exists) is dropped rather than sent as
 * "PIN: " -- and runs of blank lines that leaves behind are collapsed.
 */
export function renderStageMessage(stages: OrderStage[], status: string, values: StageMessageValues) {
  const stage = stages.find((s) => s.key === status);
  const template = stage?.message?.trim() ? stage.message : (DEFAULT_MESSAGES[status] || 'Hi {name}, your YOYO GEMS order #{order} is now: {stage}.');
  // A line about the courier ("Sent through {courier}.") is dropped while no
  // courier is chosen, even if it also has other placeholders.
  const map: Record<string, string> = {
    name: (values.name || '').trim(),
    order: String(values.order),
    stage: milestoneLabel(status, stages),
    link: values.link || '',
    login: values.login || '',
    pin: values.pin || '',
    pdf: values.pdf || '',
    courier: (values.courier || '').trim()
  };
  // [optional text] keeps its words only when every placeholder inside it is
  // filled, e.g. "placed[ and dispatched from {courier}]." -> "placed." when
  // there's no courier yet. Brackets with no placeholder are left as typed.
  const filled = template.replace(/\[([^\[\]\n]*)\]/g, (whole, inner: string) => {
    const inside = [...inner.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((t) => t in map);
    if (!inside.length) return whole;
    return inside.every((t) => map[t]) ? inner : '';
  });
  const lines = filled.split('\n').flatMap((line) => {
    const tokens = [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((t) => t in map);
    if (tokens.length && tokens.every((t) => !map[t])) return [];
    if (tokens.includes('courier') && !map.courier) return [];
    return [line.replace(/\{(\w+)\}/g, (whole, t) => (t in map ? map[t] : whole))];
  });
  return lines
    .map((l) => l.replace(/\bHi\s+,/, 'Hi,').replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Does this stage's message use the buyer's PIN? (Admin warns when there's none.) */
export function stageUsesPin(stages: OrderStage[], status: string) {
  return /\{pin\}/.test(stages.find((s) => s.key === status)?.message || '');
}

/** Where {link} points: the order page (sign-in brings the buyer back to it). */
export function orderPageUrl(orderId: number | string) {
  return `https://www.yoyogems.co.in/po/account/orders/${orderId}`;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  placed: { bg: '#e6ecf5', fg: '#1B3A6B' },
  confirmed: { bg: '#e6f0ea', fg: '#1f7a4d' },
  sourcing: { bg: '#ece9f5', fg: '#4a3f86' },
  quality_check: { bg: '#e4f1f4', fg: '#1f6b7a' },
  packed: { bg: '#eef0e6', fg: '#5d6b27' },
  shipped: { bg: '#f3e9d8', fg: '#9C7A25' },
  delivered: { bg: '#e1f3e1', fg: '#217a34' },
  cancelled: { bg: '#f8e2e0', fg: '#a3372c' }
};

export function milestoneColor(status: string) {
  return STATUS_COLORS[status] || { bg: '#eee', fg: '#3A3F44' };
}
