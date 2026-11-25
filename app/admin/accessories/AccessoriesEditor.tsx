'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { confirmAction } from '@/components/admin/AdminDialogs';
import {
  DEFAULT_PAGE_INTRO, DEFAULT_PAGE_TITLE, DEFAULT_WHATSAPP, effectiveCatalogue, emptyOverrides, orderedRanges, serializeOverrides,
  type AccessoryCatalogue, type AccessoryOverrides, type EffectiveRange, type EffectiveStyle, type RangeEdit, type StyleEdit
} from '@/lib/accessories/overrides';

// Admin > Accessories: the Accessories page as buyers see it -- category
// cards, then a category's style cards -- with every name, code and
// description editable in place, and Hide / Delete on each card. Everything is
// saved together from the bar at the bottom; Discard puts it all back. Delete
// takes an item off the page and out of this list; it can be restored from Deleted.

type Filter = 'all' | 'hidden' | 'out' | 'edited' | 'deleted';
const FILTERS: [Filter, string][] = [['all', 'All'], ['hidden', 'Hidden'], ['out', 'Out of stock'], ['edited', 'Edited'], ['deleted', 'Deleted']];

// Drops keys set to undefined/false/'' so an edit put back to the original disappears.
function patchOf<T extends object>(base: T | undefined, patch: Partial<T>): T | undefined {
  const next: Record<string, unknown> = { ...(base || {}), ...patch };
  for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === false || next[k] === '') delete next[k];
  return Object.keys(next).length ? (next as T) : undefined;
}

const styleHay = (s: EffectiveStyle) => [s.sku, s.sku.replace('-', ''), s.code, s.name, s.original.name, s.original.code, s.style, ...s.colours, ...s.families].join(' ').toLowerCase();
const rangeHay = (r: EffectiveRange) => [r.id, r.series, r.series.replace('-', ''), r.name, r.original.name, r.text, r.finish].join(' ').toLowerCase();
const matches = (hay: string, q: string) => q.split(/\s+/).every((t) => hay.includes(t));
const rangeEdited = (r: EffectiveRange) => r.name !== r.original.name || r.text !== r.original.text || r.finish !== r.original.finish;
const styleEdited = (s: EffectiveStyle) => s.name !== s.original.name || s.code !== s.original.code;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function AccessoriesEditor({ catalogue, initial }: { catalogue: AccessoryCatalogue; initial: AccessoryOverrides }) {
  const router = useRouter();
  const [ov, setOv] = useState<AccessoryOverrides>(initial);
  const [saved, setSaved] = useState(() => serializeOverrides(initial, catalogue));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const current = serializeOverrides(ov, catalogue);
  const dirty = current !== saved;
  const { ranges, styles } = useMemo(() => effectiveCatalogue(ov, catalogue), [ov, catalogue]);
  const defaultOrder = useMemo(() => orderedRanges(emptyOverrides(), catalogue).map((r) => r.id), [catalogue]);
  const opened = ranges.find((r) => r.id === openId) || null;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  // Opening or leaving a category starts at its top, as on the live page.
  useEffect(() => { if (openId !== null) document.querySelector('.accx')?.scrollIntoView({ block: 'start' }); }, [openId]);

  function setPage(patch: AccessoryOverrides['page']) {
    setOv((o) => ({ ...o, page: patchOf(o.page, patch) || {} }));
    setStatus(null);
  }
  function setRange(id: string, patch: Partial<RangeEdit>) {
    setOv((o) => { const next = { ...o.ranges }; const e = patchOf(next[id], patch); if (e) next[id] = e; else delete next[id]; return { ...o, ranges: next }; });
    setStatus(null);
  }
  function setStyle(sku: string, patch: Partial<StyleEdit>) {
    setOv((o) => { const next = { ...o.styles }; const e = patchOf(next[sku], patch); if (e) next[sku] = e; else delete next[sku]; return { ...o, styles: next }; });
    setStatus(null);
  }
  function move(id: string, delta: number) {
    const ids = ranges.map((r) => r.id);
    const from = ids.indexOf(id), to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    setOv((o) => ({ ...o, order: ids.join() === defaultOrder.join() ? [] : ids }));
    setStatus(null);
  }
  async function deleteRange(r: EffectiveRange) {
    if (!(await confirmAction(`Delete ${r.name} (${r.series})? It comes off the Accessories page and out of this list once you save. You can restore it from Deleted.`))) return;
    setRange(r.id, { deleted: true });
    if (openId === r.id) setOpenId(null);
  }
  async function deleteStyle(s: EffectiveStyle) {
    if (!(await confirmAction(`Delete ${s.sku} ${s.name}? It comes off the Accessories page once you save. You can restore it from Deleted.`))) return;
    setStyle(s.sku, { deleted: true });
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

  // What each filter keeps. Deleted items show only under Deleted.
  const q = query.trim().toLowerCase();
  const rangeById = new Map(ranges.map((r) => [r.id, r]));
  const keepStyle = (s: EffectiveStyle) => {
    if (filter === 'deleted') return s.deleted;
    if (s.deleted) return false;
    if (filter === 'hidden') return s.hidden;
    if (filter === 'out') return s.out;
    if (filter === 'edited') return styleEdited(s) || s.hidden || s.out;
    return true;
  };
  const stylesOf = (id: string) => styles.filter((s) => s.cat === id);
  const keepRange = (r: EffectiveRange) => {
    if (filter === 'deleted') return r.deleted || stylesOf(r.id).some(keepStyle);
    if (r.deleted) return false;
    if (filter === 'all') return true;
    if (filter === 'hidden' && r.hidden) return true;
    if (filter === 'edited' && (rangeEdited(r) || r.hidden)) return true;
    return stylesOf(r.id).some(keepStyle);
  };
  const liveRanges = ranges.filter((r) => !r.deleted);
  const liveStyles = styles.filter((s) => !s.deleted && !rangeById.get(s.cat)?.deleted);
  const counts: Record<Filter, number> = {
    all: 0,
    hidden: liveRanges.filter((r) => r.hidden).length + liveStyles.filter((s) => s.hidden).length,
    out: liveStyles.filter((s) => s.out).length,
    edited: liveRanges.filter((r) => rangeEdited(r) || r.hidden).length + liveStyles.filter((s) => styleEdited(s) || s.hidden || s.out).length,
    deleted: ranges.filter((r) => r.deleted).length + styles.filter((s) => s.deleted && !rangeById.get(s.cat)?.deleted).length
  };

  const rangeCard = (r: EffectiveRange) => (
    <RangeCard key={r.id} r={r} position={ranges.indexOf(r) + 1}
      onOpen={() => { setOpenId(r.id); setQuery(''); }}
      onRename={(v) => setRange(r.id, { name: v })}
      onHide={(hidden) => setRange(r.id, { hidden })}
      onDelete={() => deleteRange(r)}
      onRestore={() => setRange(r.id, { deleted: false })} />
  );
  const styleCard = (s: EffectiveStyle, showRange: boolean) => (
    <StyleCard key={s.sku} s={s} rangeName={showRange ? rangeById.get(s.cat)?.name : undefined}
      onChange={(patch) => setStyle(s.sku, patch)} onDelete={() => deleteStyle(s)} />
  );
  const searchAll = <SearchBar value={query} onChange={setQuery} placeholder="Search any ID, code, name or colour — e.g. Y54-03, CTS, lilac" />;

  let body: React.ReactNode;
  if (opened) {
    const mine = stylesOf(opened.id);
    const list = mine.filter((s) => (opened.deleted || keepStyle(s)) && (!q || matches(styleHay(s), q)));
    const position = ranges.indexOf(opened);
    body = <>
      <section className="accx-intro">
        <button type="button" className="accx-back" onClick={() => setOpenId(null)}>&larr; All Accessories</button>
        <div className="accx-eyebrow">Series {opened.series} · ID {opened.id}{opened.hidden ? ' · Hidden' : ''}{opened.deleted ? ' · Deleted' : ''}</div>
        <EditText kind="h1" label="Category name" value={opened.name} original={opened.original.name} max={80} onChange={(v) => setRange(opened.id, { name: v })} />
        <EditText kind="p" label="Description" value={opened.text} original={opened.original.text} max={600} onChange={(v) => setRange(opened.id, { text: v })} />
        <EditText kind="line" label="Finish" value={opened.finish} original={opened.original.finish} max={160} onChange={(v) => setRange(opened.id, { finish: v })} />
        <div className="accx-actions">
          {opened.deleted
            ? <button type="button" className="btn" onClick={() => setRange(opened.id, { deleted: false })}>Restore category</button>
            : <>
              <button type="button" className="btn-ghost" aria-pressed={opened.hidden} onClick={() => setRange(opened.id, { hidden: !opened.hidden })}>{opened.hidden ? 'Show category' : 'Hide category'}</button>
              <button type="button" className="btn-ghost accx-danger" onClick={() => deleteRange(opened)}>Delete category</button>
            </>}
          <span className="accx-pos">
            Position {position + 1} of {ranges.length}
            <button type="button" className="btn-ghost hs-icon" aria-label="Move earlier on the page" disabled={position === 0} onClick={() => move(opened.id, -1)}>&larr;</button>
            <button type="button" className="btn-ghost hs-icon" aria-label="Move later on the page" disabled={position === ranges.length - 1} onClick={() => move(opened.id, 1)}>&rarr;</button>
          </span>
          <a href={`/po/accessories#${opened.id}`} target="_blank" rel="noopener">Open on the page ↗</a>
        </div>
      </section>
      <SearchBar value={query} onChange={setQuery} placeholder={`Search ${plural(mine.length, 'style')} in this category`} />
      <p className="accx-meta">{list.length === mine.length ? plural(mine.length, 'style') : `${list.length} of ${plural(mine.length, 'style')} shown`}{opened.views.length ? ` · Photo views: ${opened.views.join(', ')}` : ''}</p>
      {list.length ? <div className="accx-grid">{list.map((s) => styleCard(s, false))}</div> : <Empty />}
    </>;
  } else if (q) {
    const rs = ranges.filter((r) => keepRange(r) && matches(rangeHay(r), q));
    const ss = styles.filter((s) => keepStyle(s) && (filter === 'deleted' || !rangeById.get(s.cat)?.deleted) && matches(styleHay(s), q));
    const exact = styles.find((s) => s.sku.toLowerCase() === q || s.sku.replace('-', '').toLowerCase() === q);
    body = <>
      <PageIntro ov={ov} ranges={liveRanges.length} styles={liveStyles.length} setPage={setPage} />
      {searchAll}
      <p className="accx-meta">{plural(rs.length, 'category', 'categories')} · {plural(ss.length, 'style')} found{exact ? <> · <a href={`/po/accessories#${exact.sku}`} target="_blank" rel="noopener">Open {exact.sku} on the page ↗</a></> : null}</p>
      {rs.length > 0 && <><h2 className="accx-h2">Categories</h2><div className="accx-cgrid">{rs.map(rangeCard)}</div></>}
      {ss.length > 0 && <><h2 className="accx-h2">Styles</h2><div className="accx-grid">{ss.slice(0, 120).map((s) => styleCard(s, true))}</div></>}
      {ss.length > 120 && <p className="accx-meta">Showing the first 120 styles. Type more to narrow it down.</p>}
      {!rs.length && !ss.length && <Empty />}
    </>;
  } else {
    const rs = ranges.filter(keepRange);
    const label = FILTERS.find(([k]) => k === filter)![1].toLowerCase();
    body = <>
      <PageIntro ov={ov} ranges={liveRanges.length} styles={liveStyles.length} setPage={setPage} />
      {searchAll}
      <p className="accx-meta">{filter === 'all'
        ? `${plural(liveRanges.length, 'category', 'categories')} · ${plural(liveStyles.length, 'style')}. Tap a category to edit its styles.`
        : `${plural(rs.length, 'category', 'categories')} with ${label} items. Tap one to see them.`}</p>
      {rs.length ? <div className="accx-cgrid">{rs.map(rangeCard)}</div> : <Empty />}
    </>;
  }

  return (
    <div className="acc-editor">
      <div className="accx-filters" role="group" aria-label="Show">
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={filter === k} className={filter === k ? 'is-on' : ''} onClick={() => setFilter(k)}>
            {label}{k !== 'all' && counts[k] ? <b>{counts[k]}</b> : null}
          </button>
        ))}
      </div>
      <div className="accx">{body}</div>
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

function PageIntro({ ov, ranges, styles, setPage }: { ov: AccessoryOverrides; ranges: number; styles: number; setPage: (p: AccessoryOverrides['page']) => void }) {
  return (
    <section className="accx-intro">
      <div className="accx-eyebrow">{ranges} categories · {styles} styles</div>
      <EditText kind="h1" label="Page title" value={ov.page.title || DEFAULT_PAGE_TITLE} original={DEFAULT_PAGE_TITLE} max={80} onChange={(v) => setPage({ title: v })} />
      <EditText kind="p" label="Intro" value={ov.page.intro || DEFAULT_PAGE_INTRO} original={DEFAULT_PAGE_INTRO} max={400} onChange={(v) => setPage({ intro: v })} />
      <label className="accx-wa">WhatsApp number for enquiries
        <input inputMode="numeric" value={ov.page.whatsapp ?? ''} placeholder={DEFAULT_WHATSAPP} maxLength={15} onChange={(e) => setPage({ whatsapp: e.target.value.replace(/\D/g, '') || undefined })} />
      </label>
    </section>
  );
}

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="accx-search">
      <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      <input type="search" value={value} placeholder={placeholder} aria-label="Search accessories" onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

const Empty = () => <div className="accx-empty"><strong>Nothing here</strong><span>Try another search, or choose All above.</span></div>;

function RangeCard({ r, position, onOpen, onRename, onHide, onDelete, onRestore }: {
  r: EffectiveRange; position: number; onOpen: () => void; onRename: (v: string | undefined) => void;
  onHide: (hidden: boolean) => void; onDelete: () => void; onRestore: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  return (
    <div className={`accx-ccard${r.hidden ? ' is-hidden' : ''}${r.deleted ? ' is-deleted' : ''}`}>
      <button type="button" className="accx-cv" onClick={onOpen} aria-label={`Open ${r.name}`}>
        {r.cover ? <img src={r.cover} alt="" loading="lazy" decoding="async" /> : <span>{r.series}</span>}
        <span className="accx-pos-badge" title="Position on the page">{position}</span>
        {r.hidden && <span className="accx-badge">Hidden</span>}
        {r.deleted && <span className="accx-badge">Deleted</span>}
      </button>
      <div className="accx-ci">
        <div className="accx-eyebrow">Series {r.series} · ID {r.id}</div>
        {renaming
          ? <DraftInput className="accx-rename" label={`${r.id} name`} value={r.name} max={80} autoFocus onDone={() => setRenaming(false)} onChange={(v) => onRename(v.trim() && v !== r.original.name ? v : undefined)} />
          : <button type="button" className="accx-cname" onClick={onOpen}>{r.name}</button>}
        {r.name !== r.original.name && <small className="accx-was">Was: {r.original.name}</small>}
        <div className="accx-m"><span>{r.hidden ? 'Not on the page' : `${plural(r.shownCount, 'style')}${r.shownCount < r.styleCount ? ` of ${r.styleCount}` : ''}`}</span><button type="button" className="accx-link" onClick={onOpen}>Edit &rarr;</button></div>
        <div className="accx-card-actions">
          {r.deleted
            ? <button type="button" onClick={onRestore}>Restore</button>
            : <>
              <button type="button" onClick={() => setRenaming((v) => !v)}>{renaming ? 'Done' : 'Edit name'}</button>
              <button type="button" aria-pressed={r.hidden} onClick={() => onHide(!r.hidden)}>{r.hidden ? 'Show' : 'Hide'}</button>
              <button type="button" className="accx-danger" onClick={onDelete}>Delete</button>
            </>}
        </div>
      </div>
    </div>
  );
}

function StyleCard({ s, rangeName, onChange, onDelete }: { s: EffectiveStyle; rangeName?: string; onChange: (patch: Partial<StyleEdit>) => void; onDelete: () => void }) {
  const set = (field: 'name' | 'code', v: string) => onChange({ [field]: v.trim() && v !== s.original[field] ? v : undefined });
  return (
    <div className={`accx-card${s.hidden ? ' is-hidden' : ''}${s.deleted ? ' is-deleted' : ''}`}>
      <a className="accx-thumb" href={`/po/accessories#${s.sku}`} target="_blank" rel="noopener" title="Open on the page">
        {s.thumb ? <img src={s.thumb} alt="" loading="lazy" decoding="async" /> : <span className="accx-dots">{s.dots.slice(0, 4).map((d, i) => <i key={i} style={{ background: d }} />)}</span>}
        {s.hidden && <span className="accx-badge">Hidden</span>}
        {s.deleted && <span className="accx-badge">Deleted</span>}
        {s.out && !s.deleted && <span className="accx-badge accx-oos">Out of stock</span>}
      </a>
      <div className="accx-info">
        {rangeName && <div className="accx-eyebrow accx-cat">{rangeName}</div>}
        <DraftInput className="accx-sname" label={`${s.sku} name`} value={s.name} max={80} onChange={(v) => set('name', v)} />
        <div className="accx-n">
          <DraftInput className="accx-code" label={`${s.sku} code`} value={s.code} max={24} onChange={(v) => set('code', v)} />
          <span>· {s.sku}</span>
        </div>
        {styleEdited(s) && <small className="accx-was">Was: {s.original.code} {s.original.name} <button type="button" className="accx-link" onClick={() => onChange({ name: undefined, code: undefined })}>Undo</button></small>}
        <div className="accx-card-actions">
          {s.deleted
            ? <button type="button" onClick={() => onChange({ deleted: false })}>Restore</button>
            : <>
              <button type="button" aria-pressed={s.out} className={s.out ? 'is-on' : ''} onClick={() => onChange({ out: !s.out })}>{s.out ? 'In stock' : 'Out of stock'}</button>
              <button type="button" aria-pressed={s.hidden} onClick={() => onChange({ hidden: !s.hidden })}>{s.hidden ? 'Show' : 'Hide'}</button>
              <button type="button" className="accx-danger" onClick={onDelete}>Delete</button>
            </>}
        </div>
      </div>
    </div>
  );
}

// Text that looks like the live page (a heading, a paragraph) but is edited in place.
function EditText({ kind, label, value, original, max, onChange }: {
  kind: 'h1' | 'p' | 'line'; label: string; value: string; original: string; max: number; onChange: (v: string | undefined) => void;
}) {
  const changed = value !== original;
  return (
    <div className={`accx-edit accx-edit-${kind}`}>
      <span className="accx-edit-label">{label}</span>
      <DraftInput className={`accx-${kind}`} label={label} value={value} max={max} multiline={kind === 'p'} placeholder={label}
        onChange={(v) => onChange(v.trim() && v !== original ? v : undefined)} />
      {changed && <small className="accx-was">Was: {original} <button type="button" className="accx-link" onClick={() => onChange(undefined)}>Put back</button></small>}
    </div>
  );
}

// Keeps what is being typed (even an empty box while retyping); an empty box
// means "the original", which it shows again once you leave it.
function DraftInput({ value, max, multiline, className, label, placeholder, autoFocus, onChange, onDone }: {
  value: string; max: number; multiline?: boolean; className?: string; label?: string; placeholder?: string; autoFocus?: boolean;
  onChange: (v: string) => void; onDone?: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setDraft(value); }, [value, focused]);
  const props = {
    className, 'aria-label': label, title: label, placeholder, value: draft, maxLength: max, autoFocus,
    onFocus: () => setFocused(true),
    onBlur: () => { setFocused(false); setDraft(value); onDone?.(); },
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !multiline) (e.target as HTMLElement).blur(); },
    onChange: (e: { target: { value: string } }) => { setDraft(e.target.value); onChange(e.target.value); }
  };
  return multiline ? <textarea rows={3} {...props} /> : <input {...props} />;
}
