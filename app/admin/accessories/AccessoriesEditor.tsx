'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_PAGE_INTRO, DEFAULT_PAGE_TITLE, DEFAULT_WHATSAPP, effectiveCatalogue, orderedRanges, serializeOverrides,
  type AccessoryCatalogue, type AccessoryOverrides, type EffectiveRange, type EffectiveStyle, type RangeEdit, type StyleEdit
} from '@/lib/accessories/overrides';

type Filter = 'all' | 'hidden' | 'out' | 'edited';
const FILTERS: [Filter, string][] = [['all', 'All'], ['hidden', 'Hidden'], ['out', 'Out of stock'], ['edited', 'Edited']];

// Drops keys set to undefined/false/'' so an edit put back to the original disappears.
function patchOf<T extends object>(base: T | undefined, patch: Partial<T>): T | undefined {
  const next: Record<string, unknown> = { ...(base || {}), ...patch };
  for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === false || next[k] === '') delete next[k];
  return Object.keys(next).length ? (next as T) : undefined;
}

const styleHay = (s: EffectiveStyle) => [s.sku, s.sku.replace('-', ''), s.code, s.name, s.original.name, s.original.code, s.style, ...s.colours, ...s.families].join(' ').toLowerCase();
const rangeHay = (r: EffectiveRange) => [r.id, r.series, r.series.replace('-', ''), r.name, r.original.name, r.text, r.finish].join(' ').toLowerCase();
const matches = (hay: string, q: string) => q.split(/\s+/).every((t) => hay.includes(t));

export default function AccessoriesEditor({ catalogue, initial }: { catalogue: AccessoryCatalogue; initial: AccessoryOverrides }) {
  const router = useRouter();
  const [ov, setOv] = useState<AccessoryOverrides>(initial);
  const [saved, setSaved] = useState(() => serializeOverrides(initial, catalogue));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [covers, setCovers] = useState<Record<string, string>>({});

  const current = serializeOverrides(ov, catalogue);
  const dirty = current !== saved;
  const { ranges, styles } = useMemo(() => effectiveCatalogue(ov, catalogue), [ov, catalogue]);
  const defaultOrder = useMemo(() => orderedRanges({ page: {}, order: [], ranges: {}, styles: {} }, catalogue).map((r) => r.id), [catalogue]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // The range covers live in one 4 MB file the page already uses; load it once, after the list is up.
  useEffect(() => {
    let live = true;
    fetch('/po/accessories/data/covers.json').then((r) => (r.ok ? r.json() : {})).then((j) => { if (live) setCovers(j || {}); }).catch(() => {});
    return () => { live = false; };
  }, []);

  function setPage(patch: AccessoryOverrides['page']) {
    setOv((o) => ({ ...o, page: patchOf(o.page, patch) || {} }));
    setStatus(null);
  }
  function setRange(id: string, patch: Partial<RangeEdit>) {
    setOv((o) => { const ranges = { ...o.ranges }; const e = patchOf(ranges[id], patch); if (e) ranges[id] = e; else delete ranges[id]; return { ...o, ranges }; });
    setStatus(null);
  }
  function setStyle(sku: string, patch: Partial<StyleEdit>) {
    setOv((o) => { const styles = { ...o.styles }; const e = patchOf(styles[sku], patch); if (e) styles[sku] = e; else delete styles[sku]; return { ...o, styles }; });
    setStatus(null);
  }
  function setRangeStyles(id: string, patch: Partial<StyleEdit>) {
    setOv((o) => {
      const styles = { ...o.styles };
      catalogue.styles.filter((s) => s.cat === id).forEach((s) => { const e = patchOf(styles[s.sku], patch); if (e) styles[s.sku] = e; else delete styles[s.sku]; });
      return { ...o, styles };
    });
    setStatus(null);
  }
  function move(index: number, delta: number) {
    const ids = ranges.map((r) => r.id);
    const to = index + delta;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    setOv((o) => ({ ...o, order: ids.join() === defaultOrder.join() ? [] : ids }));
    setStatus(null);
  }
  function toggle(id: string) {
    setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    const res = await fetch('/api/admin/accessories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: current }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setSaving(false);
    if (res?.ok) {
      setSaved(current);
      setStatus({ ok: true, text: 'Saved. The Accessories page shows it now.' });
      router.refresh();
    } else {
      setStatus({ ok: false, text: `Could not save: ${data?.error || res?.status || 'no connection'}. Your changes are still here, so try again.` });
    }
  }
  function discard() {
    setOv(JSON.parse(saved));
    setStatus(null);
  }

  // What the list shows: ranges matching the search (all their styles), or ranges holding matching styles (just those).
  const q = query.trim().toLowerCase();
  const isEdited = (s: EffectiveStyle) => s.name !== s.original.name || s.code !== s.original.code;
  const styleFilter = (s: EffectiveStyle) =>
    filter === 'all' ? true : filter === 'hidden' ? s.hidden : filter === 'out' ? s.out : isEdited(s) || s.hidden || s.out;
  const view = ranges.map((r, index) => {
    const mine = styles.filter((s) => s.cat === r.id);
    const rangeHit = !q || matches(rangeHay(r), q);
    const rangeEdited = r.name !== r.original.name || r.text !== r.original.text || r.finish !== r.original.finish || r.hidden;
    let list = mine.filter((s) => (rangeHit || matches(styleHay(s), q)) && styleFilter(s));
    if (filter === 'hidden' && r.hidden) list = mine.filter((s) => rangeHit || matches(styleHay(s), q));
    const show = (rangeHit || list.length > 0) && (filter === 'all' || list.length > 0 || (filter === 'hidden' && r.hidden) || (filter === 'edited' && rangeEdited));
    return { r, index, list, show, all: mine, rangeMatch: !!q && rangeHit };
  }).filter((v) => v.show);
  const narrowed = !!q || filter !== 'all';
  const shownStyles = view.reduce((n, v) => n + v.list.length, 0);
  const exact = q && styles.find((s) => s.sku.toLowerCase() === q || s.sku.replace('-', '').toLowerCase() === q);

  const counts = {
    hidden: styles.filter((s) => s.hidden).length + ranges.filter((r) => r.hidden).length,
    out: styles.filter((s) => s.out).length,
    edited: Object.keys(ov.styles).length + Object.keys(ov.ranges).length
  };

  return (
    <div className="acc-editor">
      <section className="card acc-card" aria-label="Page text">
        <h2 className="acc-h2">Page text</h2>
        <label className="acc-field">Title
          <input value={ov.page.title ?? ''} placeholder={DEFAULT_PAGE_TITLE} maxLength={80} onChange={(e) => setPage({ title: e.target.value || undefined })} />
        </label>
        <label className="acc-field">Intro
          <textarea rows={2} value={ov.page.intro ?? ''} placeholder={DEFAULT_PAGE_INTRO} maxLength={400} onChange={(e) => setPage({ intro: e.target.value || undefined })} />
        </label>
        <label className="acc-field">WhatsApp number for enquiries <small>Country code and number, digits only</small>
          <input inputMode="numeric" value={ov.page.whatsapp ?? ''} placeholder={DEFAULT_WHATSAPP} maxLength={15} onChange={(e) => setPage({ whatsapp: e.target.value.replace(/\D/g, '') || undefined })} />
        </label>
      </section>

      <div className="acc-tools">
        <input type="search" className="acc-search" value={query} placeholder="Find an ID, code, name or colour — e.g. Y54-03, CTS, lilac" aria-label="Find a range or style" onChange={(e) => setQuery(e.target.value)} />
        <div className="acc-filters" role="group" aria-label="Show">
          {FILTERS.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={filter === k} className={filter === k ? 'is-on' : ''} onClick={() => setFilter(k)}>
              {label}{k !== 'all' && counts[k] ? <b>{counts[k]}</b> : null}
            </button>
          ))}
        </div>
        <p className="acc-count">
          {narrowed ? `${view.length} ${view.length === 1 ? 'range' : 'ranges'} · ${shownStyles} ${shownStyles === 1 ? 'style' : 'styles'} found` : `${ranges.length} ranges · ${styles.length} styles`}
          {exact ? <> · <a href={`/po/accessories#${exact.sku}`} target="_blank" rel="noopener">Open {exact.sku} on the page ↗</a></> : null}
        </p>
      </div>

      {view.length === 0 && <p className="hs-hint">Nothing matches. Try another ID, code or colour, or choose All.</p>}

      <ol className="acc-ranges">
        {view.map(({ r, index, list, all, rangeMatch }) => {
          const expanded = narrowed || open.has(r.id);
          // A search that found styles shows just those; the range's own fields open when it matched itself or is tapped open.
          const fields = !narrowed || rangeMatch || open.has(r.id);
          const hiddenStyles = all.filter((s) => s.hidden).length;
          return (
            <li key={r.id} className={`card acc-range${r.hidden ? ' is-hidden' : ''}`}>
              <div className="acc-range-head">
                <span className="acc-num" title="Position on the page">{index + 1}</span>
                <button type="button" className="acc-range-open" aria-expanded={expanded} onClick={() => toggle(r.id)}>
                  <span className="acc-cover">{covers[r.id] ? <img src={covers[r.id]} alt="" /> : <span>{r.series}</span>}</span>
                  <span className="acc-range-title">
                    <small>Series {r.series} · ID {r.id}</small>
                    <strong>{r.name}</strong>
                    <small>{r.hidden ? 'Hidden from the page' : `${all.length - hiddenStyles} of ${all.length} styles shown`}{r.name !== r.original.name ? ` · was “${r.original.name}”` : ''}</small>
                  </span>
                </button>
                <div className="acc-range-tools">
                  <button type="button" className="btn-ghost hs-icon" aria-label={`Move ${r.name} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
                  <button type="button" className="btn-ghost hs-icon" aria-label={`Move ${r.name} down`} disabled={index === ranges.length - 1} onClick={() => move(index, 1)}>↓</button>
                  <label className="hs-switch acc-switch">
                    <input type="checkbox" checked={!r.hidden} onChange={(e) => setRange(r.id, { hidden: !e.target.checked })} />
                    <span>{r.hidden ? 'Hidden' : 'Shown'}</span>
                  </label>
                </div>
              </div>

              {expanded && (
                <div className="acc-range-body">
                  {fields ? <div className="acc-range-fields">
                    <EditField label="Name" value={r.name} original={r.original.name} max={80} onChange={(v) => setRange(r.id, { name: v })} />
                    <EditField label="Description" value={r.text} original={r.original.text} max={600} multiline onChange={(v) => setRange(r.id, { text: v })} />
                    <EditField label="Finish" value={r.finish} original={r.original.finish} max={160} onChange={(v) => setRange(r.id, { finish: v })} />
                    <p className="acc-meta">Photo views: {r.views.join(', ') || '—'} · <a href={`/po/accessories#${r.id}`} target="_blank" rel="noopener">Open range ↗</a></p>
                    <div className="acc-bulk">
                      <button type="button" className="hs-link" onClick={() => setRangeStyles(r.id, { hidden: false })}>Show all styles</button>
                      <button type="button" className="hs-link" onClick={() => setRangeStyles(r.id, { out: false })}>Clear out of stock</button>
                    </div>
                  </div> : <button type="button" className="hs-link acc-edit-range" onClick={() => toggle(r.id)}>Edit range name &amp; description</button>}
                  {list.length > 0 ? (
                    <ul className="acc-styles">
                      {list.map((s) => <StyleRow key={s.sku} s={s} onChange={(patch) => setStyle(s.sku, patch)} />)}
                    </ul>
                  ) : <p className="hs-hint">No styles match here.</p>}
                  {narrowed && list.length < all.length && (
                    <p className="acc-meta">Showing {list.length} of {all.length} styles in this range.</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className={`hs-savebar${dirty ? ' is-dirty' : ''}`} role="region" aria-label="Save changes">
        <span className="hs-savebar-text" role="status">
          {status ? <span className={status.ok ? 'hs-ok' : 'hs-err'}>{status.text}</span> : dirty ? 'You have unsaved changes.' : 'All changes saved.'}
        </span>
        <button type="button" className="btn-ghost" disabled={!dirty || saving} onClick={discard}>Discard</button>
        <button type="button" className="btn" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  );
}

function EditField({ label, value, original, max, multiline, onChange }: {
  label: string; value: string; original: string; max: number; multiline?: boolean; onChange: (v: string | undefined) => void;
}) {
  const changed = value !== original;
  const set = (v: string) => onChange(v.trim() && v !== original ? v : undefined);
  return (
    <label className="acc-field">
      <span className="acc-field-label">{label}{changed && <button type="button" className="hs-link" onClick={(e) => { e.preventDefault(); onChange(undefined); }}>Put back original</button>}</span>
      <DraftInput value={value} max={max} multiline={multiline} onChange={set} />
      {changed && <small className="acc-was">Was: {original}</small>}
    </label>
  );
}

function StyleRow({ s, onChange }: { s: EffectiveStyle; onChange: (patch: Partial<StyleEdit>) => void }) {
  const set = (field: 'name' | 'code', v: string) => onChange({ [field]: v.trim() && v !== s.original[field] ? v : undefined });
  return (
    <li className={`acc-style${s.hidden ? ' is-hidden' : ''}`}>
      <span className="acc-dots" aria-hidden="true">{s.dots.slice(0, 4).map((d, i) => <i key={i} style={{ background: d }} />)}</span>
      <a className="acc-sku" href={`/po/accessories#${s.sku}`} target="_blank" rel="noopener" title="Open on the page">{s.sku} ↗</a>
      <DraftInput className="acc-code" label={`${s.sku} code`} value={s.code} max={24} onChange={(v) => set('code', v)} />
      <DraftInput className="acc-name" label={`${s.sku} name`} value={s.name} max={80} onChange={(v) => set('name', v)} />
      <span className="acc-style-meta">{s.style}{s.colours.length ? ` · ${s.colours.join(', ')}` : ''}
        {(s.name !== s.original.name || s.code !== s.original.code) && <> · was {s.original.code} {s.original.name} <button type="button" className="hs-link" onClick={() => onChange({ name: undefined, code: undefined })}>Undo</button></>}
      </span>
      <span className="acc-style-flags">
        <label><input type="checkbox" checked={s.out} onChange={(e) => onChange({ out: e.target.checked })} /> Out of stock</label>
        <label><input type="checkbox" checked={!s.hidden} onChange={(e) => onChange({ hidden: !e.target.checked })} /> Shown</label>
      </span>
    </li>
  );
}

// Keeps what is being typed (even an empty box while retyping); an empty box
// means "the original", which it shows again once you leave it.
function DraftInput({ value, max, multiline, className, label, onChange }: {
  value: string; max: number; multiline?: boolean; className?: string; label?: string; onChange: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setDraft(value); }, [value, focused]);
  const props = {
    className, 'aria-label': label, value: draft, maxLength: max,
    onFocus: () => setFocused(true),
    onBlur: () => { setFocused(false); setDraft(value); },
    onChange: (e: { target: { value: string } }) => { setDraft(e.target.value); onChange(e.target.value); }
  };
  return multiline ? <textarea rows={3} {...props} /> : <input {...props} />;
}
