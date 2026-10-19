'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { specialCategory } from '@/lib/order-specs';
import { expandQtyShorthand } from '@/lib/quantity';
import { lineQualities } from '@/lib/qualities';
import { SWISS_CATEGORY_ID } from '@/lib/swiss-weights';
import {
  isReady, parsePastedList, resolveAll,
  type PasteField, type PastedLine, type PastePick, type PasteResolved, type PasteRow, type ResolveContext,
} from '@/lib/paste-order';
import { useCategoryQualities, useOrderPreferences, useShapeQualities } from './useOrderPreferences';
import { useCatalogueMap } from './useCatalogueMap';

// Moissanite is ordered by carat from its own size sheet.
const MOISSANITE_CATEGORY_ID = 34;
const DRAFT_KEY = 'yoyo-paste-list-draft';

const fmt = (n: number) => n.toLocaleString('en-IN');
const FIELD_WORD: Record<PasteField, string> = { stone: 'stone', colour: 'colour', shape: 'shape', size: 'size', quantity: 'quantity', quality: 'quality' };

/**
 * "Paste your list": a buyer (or the team, on Admin -> Create order) pastes
 * an order as written -- WhatsApp text or rows copied from Excel / Numbers --
 * and checks what it was read as before adding it. Lines that need a choice
 * are shown with just the choices that fit; a choice fills the same gap on
 * the other lines of that block.
 */
export default function PasteListDialog({
  open,
  onClose,
  onAdd,
  forAdmin = false,
  ownPageHref,
}: {
  open: boolean;
  onClose: () => void;
  /** Called with the lines to add. */
  onAdd: (lines: PastedLine[]) => void;
  /** The team's order builder: the buyer's own usual picks don't apply. */
  forAdmin?: boolean;
  /** Where a stone ordered on its own page lives (category slug -> URL). */
  ownPageHref?: (slug: string) => string;
}) {
  const [everOpened, setEverOpened] = useState(false);
  const map = useCatalogueMap(everOpened);
  const [slow, setSlow] = useState(false);
  const [text, setText] = useState('');
  const [stage, setStage] = useState<'write' | 'review'>('write');
  const [parsed, setParsed] = useState<{ rows: PasteRow[]; ignored: string[] }>({ rows: [], ignored: [] });
  const [picks, setPicks] = useState<Record<string, PastePick>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState(0);
  const [adding, setAdding] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const categoryQualities = useCategoryQualities();
  const shapeQualities = useShapeQualities();
  const preferences = useOrderPreferences();

  useEffect(() => {
    if (!open) return;
    let live = true;
    setEverOpened(true);
    const wait = setTimeout(() => { if (live) setSlow(true); }, 8000);
    try { const d = localStorage.getItem(DRAFT_KEY); if (d && !text) setText(d); } catch { /* no draft */ }
    const t = setTimeout(() => boxRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { live = false; clearTimeout(t); clearTimeout(wait); document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    try { if (text.trim()) localStorage.setItem(DRAFT_KEY, text); else localStorage.removeItem(DRAFT_KEY); } catch { /* not kept */ }
  }, [text]);

  const ctx: ResolveContext = useMemo(() => {
    const white = map?.colors.find((c) => c.name.trim().toLowerCase() === 'white')?.id ?? null;
    return {
      qualities: (categoryId, shapeId) => lineQualities(categoryQualities, shapeQualities, categoryId, shapeId),
      preferredGrade: forAdmin ? undefined : (categoryId) => preferences.find((p) => p.categoryId === categoryId && p.grade)?.grade || null,
      preferredCategory: forAdmin ? undefined : (colorId) => {
        const family = map?.colors.find((c) => c.id === colorId)?.familyId;
        return family ? preferences.find((p) => p.familyId === family)?.categoryId ?? null : null;
      },
      fixedColor: (categoryId) => (categoryId === SWISS_CATEGORY_ID ? white : null),
      ownPage: (categoryId) => !!specialCategory(categoryId) || categoryId === MOISSANITE_CATEGORY_ID,
    };
  }, [map, categoryQualities, shapeQualities, preferences, forAdmin]);

  const live = useMemo(() => parsed.rows.filter((r) => !removed.has(r.key)), [parsed.rows, removed]);
  const resolved = useMemo(() => (map ? resolveAll(live, picks, map, ctx) : []), [map, live, picks, ctx]);
  const readyCount = resolved.filter(isReady).length;
  const askCount = resolved.length - readyCount;
  const readyPieces = resolved.reduce((n, r) => (isReady(r) ? n + (r.qty || 0) : n), 0);

  if (!open || typeof document === 'undefined') return null;

  const catName = (id: number | null) => map?.categories.find((c) => c.id === id)?.name || '';
  const colourName = (id: number | null) => map?.colors.find((c) => c.id === id)?.name || '';
  const shapeName = (id: number | null) => map?.shapes.find((s) => s.id === id)?.name || '';
  const sizeName = (id: number | null) => map?.sizes.find((s) => s.id === id)?.sizeMm || '';

  function read() {
    if (!map || !text.trim()) return;
    setParsed(parsePastedList(text, map));
    setPicks({});
    setRemoved(new Set());
    setEditing(new Set());
    setAdded(0);
    setStage('review');
  }

  // A choice fills the same gap on every line of its block that has it and
  // can take it; a quantity is only ever for its own line.
  function choose(index: number, field: keyof PastePick, value: number | string | undefined) {
    const row = live[index];
    const next = { ...picks };
    const set = (key: string) => {
      const p = { ...(next[key] || {}) } as Record<string, unknown>;
      if (value === undefined || value === '') delete p[field]; else p[field] = value;
      // A new stone resets the choices that belonged to the old one.
      if (field === 'categoryId') { delete p.colorId; delete p.shapeId; delete p.sizeId; delete p.grade; }
      if (field === 'shapeId') delete p.sizeId;
      next[key] = p as PastePick;
    };
    set(row.key);
    if (field !== 'qty' && field !== 'sizeId' && value !== undefined && value !== '') {
      const missingField: Partial<Record<keyof PastePick, PasteField>> = { categoryId: 'stone', colorId: 'colour', shapeId: 'shape', grade: 'quality' };
      const gap = missingField[field];
      live.forEach((other, i) => {
        if (i === index || other.block !== row.block || !gap) return;
        const r = resolved[i];
        if (!r.missing.includes(gap)) return;
        const fits = field === 'categoryId' ? r.categoryChoices.includes(value as number)
          : field === 'colorId' ? r.colorChoices.includes(value as number)
          : field === 'shapeId' ? r.shapeChoices.includes(value as number)
          : r.gradeChoices.includes(value as string);
        if (fits) set(other.key);
      });
    }
    setPicks(next);
  }

  function remove(key: string) {
    setRemoved((cur) => new Set(cur).add(key));
  }

  async function addReady() {
    if (!map || !readyCount || adding) return;
    setAdding(true);
    const lines: PastedLine[] = [];
    const doneKeys: string[] = [];
    resolved.forEach((r, i) => {
      if (!isReady(r)) return;
      const color = map.colors.find((c) => c.id === r.colorId)!;
      const shape = map.shapes.find((s) => s.id === r.shapeId)!;
      lines.push({
        categoryId: r.categoryId!, categoryName: catName(r.categoryId),
        shapeId: shape.id, shapeName: shape.name, shapeRefPhotoUrl: shape.refPhotoUrl,
        sizeId: r.sizeId!, sizeMm: sizeName(r.sizeId),
        colorId: color.id, colorName: color.name, colorHex: color.hex, colorRefPhotoUrl: color.refPhotoUrl,
        qty: r.qty!, grade: r.grade, note: live[i].hints.note,
      });
      doneKeys.push(live[i].key);
    });
    // The category's own shape photos and what its quantity counts ("lines").
    const ids = [...new Set(lines.map((l) => l.categoryId))].slice(0, 25);
    try {
      const res = await fetch(`/api/category-options?ids=${ids.join(',')}`);
      const data = res.ok ? await res.json() : null;
      for (const l of lines) {
        const o = data?.options?.[l.categoryId];
        if (!o) continue;
        const s = o.shapes?.find((x: { id: number }) => x.id === l.shapeId);
        if (s) { l.shapeRefPhotoUrl = s.refPhotoUrl ?? l.shapeRefPhotoUrl; l.shapeIconKey = s.iconKey ?? null; }
        l.qtyUnit = o.qtyUnit ?? null;
      }
    } catch { /* lines still add with the shared shape photo */ }
    onAdd(lines);
    setAdding(false);
    setAdded((n) => n + lines.length);
    const left = live.filter((r) => !doneKeys.includes(r.key));
    if (!left.length) {
      setText('');
      setStage('write');
      setParsed({ rows: [], ignored: [] });
      onClose();
      return;
    }
    setRemoved((cur) => { const n = new Set(cur); doneKeys.forEach((k) => n.add(k)); return n; });
  }

  function select(index: number, field: keyof PastePick, choices: number[], current: number | null, label: string, nameOf: (id: number) => string) {
    return (
      <label className="pl-pick">
        <span>{label}</span>
        <select value={current ?? ''} onChange={(e) => choose(index, field, e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">Choose…</option>
          {choices.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
        </select>
      </label>
    );
  }

  function rowView(row: PasteRow, r: PasteResolved, index: number) {
    const ready = isReady(r);
    const expanded = editing.has(row.key);
    const show = (f: PasteField) => expanded || r.missing.includes(f);
    const cat = map?.categories.find((c) => c.id === r.categoryId);
    return (
      <li key={row.key} className={`pl-row${ready ? ' pl-row--ok' : r.ownPage ? ' pl-row--page' : ' pl-row--ask'}`}>
        <div className="pl-row-main">
          <span className="pl-row-mark" aria-hidden="true">{ready ? '✓' : r.ownPage ? '↗' : '!'}</span>
          <div className="pl-row-text">
            <strong>
              {r.shapeId ? shapeName(r.shapeId) : 'Shape?'} · {r.sizeId ? `${sizeName(r.sizeId)} mm` : row.hints.sizeText ? `${row.hints.sizeText} mm?` : 'Size?'}
              {' · '}{r.qty ? `${fmt(r.qty)} pcs` : 'Qty?'}
            </strong>
            <span>
              {r.categoryId ? catName(r.categoryId) : 'Stone?'}{' · '}{r.colorId ? colourName(r.colorId) : 'Colour?'}{r.grade ? ` · ${r.grade}` : ''}
            </span>
            {row.hints.note && <em>{row.hints.note}</em>}
            {!ready && (
              <span className="pl-row-why">
                {r.ownPage
                  ? <>{catName(r.categoryId)} is ordered on its own page{ownPageHref && cat?.slug ? <> — <a href={ownPageHref(cat.slug)} target="_blank" rel="noopener noreferrer">open it</a></> : ''}.</>
                  : r.problem || `Choose the ${r.missing.map((f) => FIELD_WORD[f]).join(', ')}`}
              </span>
            )}
            <span className="pl-row-raw">Line {row.line}: {row.raw}</span>
          </div>
          <div className="pl-row-actions">
            {!r.ownPage && (
              <button type="button" className="pl-link" onClick={() => setEditing((cur) => { const n = new Set(cur); if (n.has(row.key)) n.delete(row.key); else n.add(row.key); return n; })}>
                {expanded ? 'Done' : ready ? 'Change' : 'All fields'}
              </button>
            )}
            <button type="button" className="pl-remove" aria-label={`Remove line ${row.line}`} onClick={() => remove(row.key)}>×</button>
          </div>
        </div>
        {!r.ownPage && (expanded || !ready) && (
          <div className="pl-picks">
            {show('stone') && select(index, 'categoryId', expanded && !r.missing.includes('stone') ? (map?.categories.map((c) => c.id) || []) : r.categoryChoices, r.categoryId, 'Stone', (id) => catName(id))}
            {r.categoryId && show('colour') && select(index, 'colorId', expanded && !r.missing.includes('colour') ? (cat?.colorIds || []) : r.colorChoices, r.colorId, 'Colour', (id) => colourName(id))}
            {r.categoryId && show('shape') && select(index, 'shapeId', expanded && !r.missing.includes('shape') ? (cat?.shapeIds || []) : r.shapeChoices, r.shapeId, 'Shape', (id) => shapeName(id))}
            {r.shapeId && show('size') && select(index, 'sizeId', r.sizeChoices, r.sizeId, 'Size (mm)', (id) => sizeName(id))}
            {show('quantity') && (
              <label className="pl-pick pl-pick--qty">
                <span>Qty (pcs)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={picks[row.key]?.qty ?? r.qty ?? ''}
                  placeholder="e.g. 500"
                  onChange={(e) => { const v = expandQtyShorthand(e.target.value).replace(/\D/g, ''); choose(index, 'qty', v ? Number(v) : undefined); }}
                />
              </label>
            )}
            {r.gradeChoices.length > 0 && show('quality') && (
              <div className="pl-pick">
                <span>Quality</span>
                <div className="pl-grades" role="group">
                  {r.gradeChoices.map((g) => (
                    <button key={g} type="button" aria-pressed={r.grade === g} className={r.grade === g ? 'active' : ''} onClick={() => choose(index, 'grade', g)}>{g}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </li>
    );
  }

  return createPortal(
    <div className="pl-backdrop" onClick={onClose}>
      <div className="pl-dialog" role="dialog" aria-modal="true" aria-labelledby="pl-title" onClick={(e) => e.stopPropagation()}>
        <header className="pl-head">
          <h2 id="pl-title">{stage === 'write' ? 'Paste your list' : 'Check your list'}</h2>
          <button type="button" className="pl-close" aria-label="Close" onClick={onClose}>×</button>
        </header>

        {stage === 'write' ? (
          <div className="pl-body">
            <p className="pl-hint">
              Copy your order from WhatsApp, Excel or your notes and paste it here. A line with just the stone, colour or shape applies to the lines under it.
            </p>
            <textarea
              ref={boxRef}
              className="pl-text"
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'Blue Nano #114 Pear\n4x6 1000\n5x7 2000\nOval 4x6 1000\n\nYellow CZ Oval 5x7 500'}
              spellCheck={false}
            />
            {slow && !map && <p className="po-field-error" role="alert">Couldn&rsquo;t load the catalogue. Check your connection and try again.</p>}
          </div>
        ) : (
          <div className="pl-body">
            {added > 0 && <p className="pl-added" role="status">Added {fmt(added)} {added === 1 ? 'line' : 'lines'}. {askCount ? 'These still need a choice:' : ''}</p>}
            {!live.length && <p className="pl-hint">No order lines found. Each line needs a size and a quantity, e.g. <b>Pear 5x7 1000</b>.</p>}
            {live.length > 0 && (
              <p className="pl-summary">
                <b>{fmt(readyCount)}</b> ready{readyCount ? ` (${fmt(readyPieces)} pcs)` : ''}
                {askCount > 0 && <> · <b className="pl-summary-ask">{fmt(askCount)}</b> need a choice</>}
              </p>
            )}
            <ol className="pl-rows">
              {live.map((row, i) => resolved[i] && rowView(row, resolved[i], i))}
            </ol>
            {parsed.ignored.length > 0 && (
              <details className="pl-ignored">
                <summary>{parsed.ignored.length} {parsed.ignored.length === 1 ? 'line' : 'lines'} not read</summary>
                <ul>{parsed.ignored.map((l, i) => <li key={i}>{l}</li>)}</ul>
              </details>
            )}
          </div>
        )}

        <footer className="pl-foot">
          {stage === 'write' ? (
            <button type="button" className="po-add-line-btn" onClick={read} disabled={!text.trim() || !map}>
              {map ? 'Read list' : 'Loading catalogue…'}
            </button>
          ) : (
            <>
              <button type="button" className="pl-link" onClick={() => setStage('write')}>Edit list</button>
              <button type="button" className="po-add-line-btn" onClick={addReady} disabled={!readyCount || adding}>
                {adding ? 'Adding…' : readyCount ? `Add ${askCount ? `${fmt(readyCount)} ready` : fmt(readyCount)} ${readyCount === 1 ? 'line' : 'lines'}` : 'Nothing ready to add'}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>,
    document.body
  );
}
