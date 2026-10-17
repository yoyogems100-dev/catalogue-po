'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import IconSelect from './IconSelect';
import { useCatalogueMap } from './useCatalogueMap';
import { useCategoryQualities, useShapeQualities } from './useOrderPreferences';
import { categoryIconUrl } from '@/lib/category-icons';
import { colorFamilyId } from '@/lib/color-family';
import { sizeKey } from '@/lib/size-options';
import { compareSizeKeys, type CatalogueMap } from '@/lib/catalogue-map';
import { gradeSpec } from '@/lib/order-specs';
import { loadCart, saveCart, mergeIntoCart, type CartItem } from '@/lib/cart-storage';
import {
  buildVocabulary, parseOrderText, resolveLine, refitLine, missingParts, nearestSizes, gradesFor, needsOwnPage, bestAlternative,
  type ParseContext, type VoiceLine
} from '@/lib/voice-order';

// Speak (or type, or paste from WhatsApp) an order and get an editable grid
// of lines: "ice crush cushion 4mm 1000, 5mm 500, 2mm 3mm 1mm ka 600 piece".
// The interpreting is lib/voice-order.ts and runs on the phone; speech-to-text
// is the browser's own (Chrome/Android and Safari/iPhone). Anything that
// couldn't be matched stays empty and highlighted, with what was heard beside
// it, so the buyer picks it rather than us guessing. Like Quick Order, it
// writes straight into the shared cart (lib/cart-storage.ts).

/** Opens Speak order from elsewhere (Quick Order, the home page prompt). */
export const VOICE_ORDER_OPEN_EVENT = 'yoyo:voice-order-open';

const DRAFT_KEY = 'yoyo_voice_order_v1';
const LANG_KEY = 'yoyo_voice_lang';
const EXAMPLE = 'Ice crush cushion 4mm 1000, 5mm 500, 2mm 3mm 1mm ka 600 piece';

type Draft = { rows: VoiceLine[]; context: ParseContext };
type Lang = 'en-IN' | 'hi-IN';

function loadDraft(): Draft {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Array.isArray(parsed.rows)) return { rows: parsed.rows, context: parsed.context || {} };
  } catch { /* private mode or bad JSON: start empty */ }
  return { rows: [], context: {} };
}
function saveDraft(d: Draft) {
  try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* storage off: the grid still works */ }
}

function recognitionClass(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function MicIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8" />
    </svg>
  );
}

/**
 * `categoryId` starts the order on that stone (the category page), so "4mm
 * 1000, 5mm 500" is enough. `listenForOpen` makes this the copy that answers
 * VOICE_ORDER_OPEN_EVENT -- one per page, like Quick Order's colour start.
 */
export default function VoiceOrderButton({ label = 'Speak order', categoryId, listenForOpen = false }: { label?: string; categoryId?: number; listenForOpen?: boolean }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const map = useCatalogueMap(open);
  const qualities = useCategoryQualities();
  const shapeQualities = useShapeQualities();
  const opts = useMemo(() => ({ qualities, shapeQualities }), [qualities, shapeQualities]);
  const vocab = useMemo(() => (map ? buildVocabulary(map) : null), [map]);

  const [rows, setRows] = useState<VoiceLine[]>([]);
  const [context, setContext] = useState<ParseContext>({});
  const [loaded, setLoaded] = useState(false);
  const [typed, setTyped] = useState('');
  const [heard, setHeard] = useState('');
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [lang, setLang] = useState<Lang>('en-IN');
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState(false); // message is a problem (amber), not a success
  const [cartLines, setCartLines] = useState(0);
  const recognition = useRef<any>(null);
  const finals = useRef<string[][]>([]);

  useEffect(() => {
    setSupported(!!recognitionClass());
    try { if (window.localStorage.getItem(LANG_KEY) === 'hi-IN') setLang('hi-IN'); } catch { /* default English */ }
  }, []);
  useEffect(() => { if (open && !dialog.current?.open) dialog.current?.showModal(); }, [open]);
  useEffect(() => {
    if (!listenForOpen) return;
    const onOpen = () => { opener.current = null; setOpen(true); };
    window.addEventListener(VOICE_ORDER_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(VOICE_ORDER_OPEN_EVENT, onOpen);
  }, [listenForOpen]);
  useEffect(() => {
    if (!open || loaded) return;
    const d = loadDraft();
    setRows(d.rows);
    // On a stone's page, that stone is where a new sentence starts.
    setContext(categoryId ? { category: { ids: [categoryId], heard: '' } } : d.context);
    setCartLines(loadCart().length);
    setLoaded(true);
  }, [open, loaded]);
  useEffect(() => { if (loaded) saveDraft({ rows, context }); }, [rows, context, loaded]);
  useEffect(() => () => recognition.current?.abort?.(), []);

  function close() { stop(); dialog.current?.close(); }

  function interpret(text: string) {
    if (!map || !vocab) { setProblem(true); setMessage('Still loading the catalogue — try again in a moment.'); return; }
    const clean = text.trim();
    if (!clean) return;
    const { lines, context: next } = parseOrderText(clean, map, context, vocab);
    setHeard(clean);
    setProblem(false);
    if (!lines.length) {
      setProblem(true);
      setMessage(`Couldn't find an order in that. Try: “${EXAMPLE}”.`);
      return;
    }
    const resolved = lines.map((l) => resolveLine(map, l, opts));
    setRows((cur) => [...cur, ...resolved]);
    setContext(next);
    const unclear = resolved.filter((r) => missingParts(map, r, opts).length).length;
    setMessage(`${resolved.length} line${resolved.length === 1 ? '' : 's'} added below${unclear ? ` — ${unclear} need${unclear === 1 ? 's' : ''} a choice (highlighted)` : ''}.`);
  }

  function start() {
    const SR = recognitionClass();
    if (!SR) { setSupported(false); return; }
    setMessage('');
    setProblem(false);
    finals.current = [];
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 4;
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finals.current.push(Array.from({ length: r.length }, (_, k) => r[k].transcript as string));
        else interim += r[0].transcript;
      }
      setHeard([...finals.current.map((a) => a[0]), interim].join(' ').trim());
    };
    rec.onerror = (e: any) => {
      setProblem(true);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setMessage('Microphone is blocked. Allow the microphone for this site, or type below.');
      else if (e.error === 'no-speech') setMessage('Didn’t hear anything — tap the mic and speak again.');
      else if (e.error !== 'aborted') setMessage('Voice stopped. Tap the mic to try again, or type below.');
    };
    rec.onend = () => {
      setListening(false);
      recognition.current = null;
      if (!finals.current.length || !map || !vocab) return;
      // Each sentence: the recogniser's guess that names the most catalogue words.
      let ctx = context;
      const picked = finals.current.map((alts) => {
        const best = bestAlternative(alts, map, ctx, vocab);
        ctx = parseOrderText(best, map, ctx, vocab).context;
        return best;
      });
      finals.current = [];
      interpret(picked.join(', '));
    };
    try {
      rec.start();
      recognition.current = rec;
      setListening(true);
      setHeard('');
    } catch {
      setMessage('Couldn’t start the microphone. Type your order below instead.');
    }
  }

  function stop() { recognition.current?.stop?.(); }

  function chooseLang(next: Lang) {
    setLang(next);
    try { window.localStorage.setItem(LANG_KEY, next); } catch { /* not remembered */ }
  }

  function update(key: string, change: (r: VoiceLine) => VoiceLine, refit = false) {
    if (!map) return;
    setRows((cur) => cur.map((r) => (r.key === key ? (refit ? refitLine(map, change(r), opts) : change(r)) : r)));
  }
  // A stone or colour chosen on one line also fills the other lines still
  // missing it -- an order is usually one stone in one colour, and choosing
  // the same thing five times over is the tedious part. Lines that already
  // have a value are left alone.
  function setCategory(key: string, id: number | null) {
    if (!map) return;
    let others = 0;
    setRows((cur) => cur.map((r) => {
      const self = r.key === key;
      if (!self && (r.categoryId || !id)) return r;
      if (!self) others++;
      return refitLine(map, { ...r, categoryId: id, guessed: {}, heard: { ...r.heard, category: undefined } }, opts);
    }));
    if (others) setMessage(`Also set on ${others} other line${others === 1 ? '' : 's'} with no stone.`);
  }
  function setColor(key: string, id: number | null) {
    const row = rows.find((r) => r.key === key);
    let others = 0;
    setRows((cur) => cur.map((r) => {
      const self = r.key === key;
      if (!self && (r.colorId || !id || r.categoryId !== row?.categoryId)) return r;
      if (!self) others++;
      return { ...r, colorId: id, heard: { ...r.heard, color: undefined, colorFamily: undefined } };
    }));
    if (others) setMessage(`Also set on ${others} other line${others === 1 ? '' : 's'} of this stone.`);
  }
  function setShape(key: string, id: number | null) {
    update(key, (r) => ({ ...r, shapeId: id, heard: { ...r.heard, shape: undefined } }), true);
  }
  function addEmptyRow() {
    const last = rows[rows.length - 1];
    const base: VoiceLine = { key: `m${Date.now().toString(36)}`, categoryId: last?.categoryId ?? null, shapeId: last?.shapeId ?? null, sizeId: null, colorId: last?.colorId ?? null, grade: last?.grade ?? null, qty: null, heard: {}, guessed: {} };
    setRows((cur) => [...cur, map ? refitLine(map, base, opts) : base]);
  }

  const ready = map ? rows.filter((r) => !missingParts(map, r, opts).length && !needsOwnPage(r.categoryId)) : [];

  function addToCart() {
    if (!map || !ready.length) return;
    let cart = loadCart();
    for (const r of ready) {
      const category = map.categories.find((c) => c.id === r.categoryId)!;
      const shape = map.shapes.find((s) => s.id === r.shapeId)!;
      const size = map.sizes.find((s) => s.id === r.sizeId)!;
      const color = map.colors.find((c) => c.id === r.colorId)!;
      const item: CartItem = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        categoryId: category.id,
        categoryName: category.name,
        shapeId: shape.id,
        shapeName: shape.name,
        shapeRefPhotoUrl: shape.refPhotoUrl,
        shapeIconKey: null,
        sizeId: size.id,
        sizeMm: size.sizeMm,
        colorId: color.id,
        colorName: color.name,
        colorHex: color.hex || '#ccc',
        colorRefPhotoUrl: color.refPhotoUrl || null,
        qty: r.qty!,
        requestType: 'Place Order',
        ...(r.grade && gradesFor(opts, category.id, shape.id).includes(r.grade) ? { orderSpecs: gradeSpec(r.grade) } : {})
      };
      cart = mergeIntoCart(cart, item);
    }
    saveCart(cart);
    setCartLines(cart.length);
    const done = new Set(ready.map((r) => r.key));
    const left = rows.length - done.size;
    setRows((cur) => cur.filter((r) => !done.has(r.key)));
    setMessage(`Added ${done.size} line${done.size === 1 ? '' : 's'} to your cart.${left ? ` ${left} still need${left === 1 ? 's' : ''} a choice.` : ''}`);
  }

  return (
    <>
      <button
        type="button"
        className="voice-order-btn"
        aria-label={label}
        title={label}
        onClick={(e) => { opener.current = e.currentTarget; setOpen(true); }}
      >
        <MicIcon size={15} /><span className="voice-order-btn-label">{label}</span>
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="quick-order-dialog voice-order-dialog"
          aria-label="Speak your order"
          onCancel={(e) => { e.preventDefault(); close(); }}
          onClose={() => { setOpen(false); setLoaded(false); opener.current?.focus(); }}
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="quick-order-head">
            <strong>Speak your order</strong>
            <button type="button" autoFocus onClick={close} aria-label="Close">✕</button>
          </div>
          <p className="quick-order-hint">
            Say the stone, shape, sizes and quantity — in English or Hindi. For example: <em>“{EXAMPLE}”</em>
          </p>

          <div className="vo-capture">
            {supported ? (
              <button
                type="button"
                className={`vo-mic${listening ? ' is-listening' : ''}`}
                onClick={listening ? stop : start}
                disabled={!map}
                aria-pressed={listening}
              >
                <MicIcon size={22} />
                <span>{!map ? 'Loading…' : listening ? 'Listening… tap when done' : rows.length ? 'Tap to speak more' : 'Tap and speak'}</span>
              </button>
            ) : (
              <p className="vo-note">Voice isn’t available in this browser. Tap the 🎤 on your keyboard and speak into the box below, or type.</p>
            )}
            {supported && (
              <div className="vo-lang" role="group" aria-label="Speaking in">
                <button type="button" aria-pressed={lang === 'en-IN'} className={lang === 'en-IN' ? 'active' : ''} onClick={() => chooseLang('en-IN')} disabled={listening}>English</button>
                <button type="button" aria-pressed={lang === 'hi-IN'} className={lang === 'hi-IN' ? 'active' : ''} onClick={() => chooseLang('hi-IN')} disabled={listening}>हिंदी</button>
              </div>
            )}
          </div>
          {heard && <p className="vo-heard" aria-live="polite"><span>Heard:</span> {heard}</p>}

          <form
            className="vo-type"
            onSubmit={(e) => { e.preventDefault(); interpret(typed); setTyped(''); }}
          >
            <textarea
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              rows={2}
              placeholder="Or type / paste an order here"
              aria-label="Type or paste an order"
            />
            <button type="submit" className="btn-ghost" disabled={!typed.trim() || !map}>Make list</button>
          </form>

          {message && <p className={`quick-order-message${problem ? ' vo-problem' : ''}`} aria-live="polite">{message}</p>}

          {map && rows.length > 0 && (
            <div className="vo-grid" role="table" aria-label="Order lines">
              <div className="vo-grid-head" role="row">
                <span role="columnheader">Stone</span><span role="columnheader">Shape</span><span role="columnheader">Size</span>
                <span role="columnheader">Colour</span><span role="columnheader">Qty (pcs)</span><span />
              </div>
              {rows.map((r, i) => (
                <VoiceRow
                  key={r.key}
                  index={i + 1}
                  row={r}
                  map={map}
                  grades={gradesFor(opts, r.categoryId, r.shapeId)}
                  missing={missingParts(map, r, opts)}
                  onCategory={(id) => setCategory(r.key, id)}
                  onShape={(id) => setShape(r.key, id)}
                  onSize={(id) => update(r.key, (x) => ({ ...x, sizeId: id, heard: { ...x.heard, size: undefined } }))}
                  onColor={(id) => setColor(r.key, id)}
                  onGrade={(g) => update(r.key, (x) => ({ ...x, grade: g }))}
                  onQty={(q) => update(r.key, (x) => ({ ...x, qty: q, heard: { ...x.heard, qty: undefined } }))}
                  onRemove={() => setRows((cur) => cur.filter((x) => x.key !== r.key))}
                />
              ))}
            </div>
          )}
          {map && (
            <div className="vo-grid-actions">
              <button type="button" className="po-inline-link" onClick={addEmptyRow}>+ Add a line by hand</button>
              {rows.length > 0 && (
                <button type="button" className="po-inline-link" onClick={() => { if (confirm('Clear every line from this list?')) { setRows([]); setContext({}); setHeard(''); setMessage(''); } }}>Clear list</button>
              )}
            </div>
          )}

          {rows.length > 0 && (
            <button type="button" className="po-add-line-btn" onClick={addToCart} disabled={!ready.length}>
              {ready.length ? `+ Add ${ready.length === rows.length ? ready.length : `${ready.length} of ${rows.length}`} line${ready.length === 1 && rows.length === 1 ? '' : 's'} to cart` : 'Fill the highlighted boxes to add'}
            </button>
          )}

          <div className="quick-order-footer">
            <span>Price and availability are confirmed by our team.</span>
            <Link href="/po/cart" className="btn-ghost" onClick={close}>Go to cart{cartLines > 0 ? ` · ${cartLines} line${cartLines === 1 ? '' : 's'}` : ''}</Link>
          </div>
        </dialog>
      )}
    </>
  );
}

function VoiceRow({ index, row, map, grades, missing, onCategory, onShape, onSize, onColor, onGrade, onQty, onRemove }: {
  index: number;
  row: VoiceLine;
  map: CatalogueMap;
  grades: string[];
  missing: string[];
  onCategory: (id: number | null) => void;
  onShape: (id: number | null) => void;
  onSize: (id: number | null) => void;
  onColor: (id: number | null) => void;
  onGrade: (g: string | null) => void;
  onQty: (q: number | null) => void;
  onRemove: () => void;
}) {
  const category = row.categoryId ? map.categories.find((c) => c.id === row.categoryId) : undefined;
  const shapeOrder = useMemo(() => new Map(map.shapes.map((s, i) => [s.id, i])), [map]);
  const shapes = useMemo(
    () => (category ? map.shapes.filter((s) => category.shapeIds.includes(s.id)).sort((a, b) => (shapeOrder.get(a.id) ?? 0) - (shapeOrder.get(b.id) ?? 0)) : []),
    [category, map, shapeOrder]
  );
  const sizes = useMemo(
    () => (category && row.shapeId
      ? map.sizes.filter((s) => s.shapeId === row.shapeId && category.sizeIds.includes(s.id))
        .sort((a, b) => compareSizeKeys(sizeKey(a.sizeMm), sizeKey(b.sizeMm)))
        .map((s) => ({ id: s.id, name: `${s.sizeMm} mm` }))
      : []),
    [category, map, row.shapeId]
  );
  const colors = useMemo(() => (category ? map.colors.filter((c) => category.colorIds.includes(c.id)) : []), [category, map]);
  // A colour heard as "white" lists the stone's whites first.
  const family = row.heard.colorFamily ?? (row.heard.color ? colorFamilyId(row.heard.color) : null);
  const familyIds = family ? colors.filter((c) => (c.familyId ?? colorFamilyId(c.name, c.hex)) === family).map((c) => c.id) : [];
  const has = (part: string) => missing.includes(part);
  const ownPage = needsOwnPage(row.categoryId);

  const heardNote = (part: 'category' | 'shape' | 'size' | 'color' | 'qty', fallback?: string) => {
    const said = row.heard[part];
    if (!said) return fallback ? <small className="vo-cell-note">{fallback}</small> : null;
    let extra = '';
    if (part === 'size' && category && row.shapeId) {
      const near = nearestSizes(map, category, row.shapeId, said);
      extra = ` — not in this shape${near.length ? `; nearest ${near.join(', ')}` : ''}`;
    } else if (part === 'shape' && category) extra = ' — not in this stone';
    else if (part === 'color' && category) extra = familyIds.length > 1 ? ' — pick the shade' : familyIds.length ? '' : ' — not in this stone';
    return <small className="vo-cell-note">Heard “{said}”{extra}</small>;
  };

  return (
    <div className={`vo-row${missing.length ? ' is-incomplete' : ''}`} role="row">
      <div className={`vo-cell vo-cell-stone${has('stone') ? ' is-missing' : ''}`} role="cell">
        <span className="vo-cell-label"><b>{index}</b> Stone</span>
        <IconSelect
          options={map.categories.map((c) => ({ id: c.id, name: c.name, refPhotoUrl: categoryIconUrl(c.slug || '') }))}
          value={row.categoryId ?? 'all'}
          onChange={(v) => onCategory(v === 'all' ? null : v)}
          allLabel="Choose stone"
          hideAllOption
          leading="photo"
          searchable
        />
        {has('stone') ? heardNote('category') : row.guessed.category && <small className="vo-cell-note is-info">Only stone with this shape &amp; size</small>}
      </div>
      <div className={`vo-cell${has('shape') ? ' is-missing' : ''}`} role="cell">
        <span className="vo-cell-label">Shape</span>
        <IconSelect
          categoryId={row.categoryId ?? undefined}
          options={shapes}
          value={row.shapeId ?? 'all'}
          onChange={(v) => onShape(v === 'all' ? null : v)}
          allLabel={category ? 'Choose shape' : '—'}
          hideAllOption
          leading="icon"
        />
        {has('shape') && heardNote('shape', category ? undefined : 'Choose the stone first')}
      </div>
      <div className={`vo-cell${has('size') ? ' is-missing' : ''}`} role="cell">
        <span className="vo-cell-label">Size</span>
        <IconSelect
          categoryId={row.categoryId ?? undefined}
          optionKind="size"
          options={sizes}
          value={row.sizeId ?? 'all'}
          onChange={(v) => onSize(v === 'all' ? null : v)}
          allLabel={row.shapeId ? 'Choose size' : '—'}
          hideAllOption
        />
        {has('size') && heardNote('size', row.shapeId || !category ? undefined : 'Choose the shape first')}
      </div>
      <div className={`vo-cell${has('colour') ? ' is-missing' : ''}`} role="cell">
        <span className="vo-cell-label">Colour</span>
        <IconSelect
          categoryId={row.categoryId ?? undefined}
          options={colors}
          value={row.colorId ?? 'all'}
          onChange={(v) => onColor(v === 'all' ? null : v)}
          allLabel={category ? 'Choose colour' : '—'}
          hideAllOption
          leading="swatch"
          searchable
          fitIds={familyIds.length > 1 ? familyIds : undefined}
          otherLabel="Other colours"
        />
        {has('colour') && heardNote('color')}
      </div>
      <div className={`vo-cell vo-cell-qty${has('qty') ? ' is-missing' : ''}`} role="cell">
        <span className="vo-cell-label">Qty (pcs)</span>
        <input
          type="text"
          inputMode="numeric"
          className="po-qty-input"
          placeholder="Qty"
          value={row.qty ?? ''}
          aria-label={`Quantity, line ${index}`}
          onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); onQty(Number.isFinite(n) && n > 0 ? n : null); }}
        />
        {has('qty') && heardNote('qty')}
      </div>
      <button type="button" className="vo-remove" onClick={onRemove} aria-label={`Remove line ${index}`}>✕</button>
      {grades.length > 0 && (
        <div className={`vo-cell vo-cell-grade${has('quality') ? ' is-missing' : ''}`} role="cell">
          <span className="vo-cell-label">Quality</span>
          <div className="po-type-toggle po-grade-toggle" role="group" aria-label={`Quality, line ${index}`}>
            {grades.map((g) => (
              <button key={g} type="button" aria-pressed={row.grade === g} className={row.grade === g ? 'active' : ''} onClick={() => onGrade(g)}>{g}</button>
            ))}
          </div>
        </div>
      )}
      {ownPage && category && (
        <p className="vo-own-page">
          {category.name} needs a few more choices — <Link href={`/po/category/${category.slug}`}>finish it on its page</Link>.
        </p>
      )}
    </div>
  );
}
