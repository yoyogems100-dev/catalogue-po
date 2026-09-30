'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDragReorder, moveItem } from '@/hooks/useDragReorder';
import { DEFAULT_REST_TITLE, newSection, serializeHomeSections, type HomeSection, type HomeSections } from '@/lib/home-sections';

type Category = { id: number; num: number; name: string; archived: boolean; thumb: string | null };

// One card per shelf, in the order buyers see them. Everything is edited in
// place and saved together from the bar at the bottom, so a half-arranged
// page never goes live and "Discard" puts it all back.
export default function HomeSectionsEditor({ categories, initial }: { categories: Category[]; initial: HomeSections }) {
  const router = useRouter();
  const [saved, setSaved] = useState(() => serializeHomeSections(initial));
  const [sections, setSections] = useState(initial.sections);
  const [restTitle, setRestTitle] = useState(initial.restTitle);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const current = serializeHomeSections({ sections, restTitle });
  const dirty = current !== saved;

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function update(key: string, patch: Partial<HomeSection>) {
    setSections((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));
    setStatus(null);
  }
  function moveSection(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= sections.length) return;
    setSections((list) => moveItem(list, index, to));
    setStatus(null);
  }
  function addSection(title?: string) {
    const s = newSection(title);
    setSections((list) => [...list, s]);
    setFocusKey(s.key);
    setStatus(null);
  }
  function removeSection(key: string) {
    setSections((list) => list.filter((s) => s.key !== key));
    setStatus({ ok: true, text: 'Section removed. Save to make it final, or Discard to bring it back.' });
  }
  function discard() {
    const back = JSON.parse(saved) as HomeSections;
    setSections(back.sections);
    setRestTitle(back.restTitle);
    setStatus(null);
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    const res = await fetch('/api/admin/home-sections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: current }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setSaving(false);
    if (res?.ok) {
      setSaved(current);
      setStatus({ ok: true, text: 'Saved. The /po home page shows it now.' });
      router.refresh();
    } else {
      setStatus({ ok: false, text: `Could not save: ${data?.error || res?.status || 'no connection'}. Your changes are still here, so try again.` });
    }
  }

  const liveCategories = categories.filter((c) => !c.archived);
  const shelved = new Set(sections.filter((s) => s.visible).flatMap((s) => s.categoryIds.filter((id) => byId.get(id) && !byId.get(id)!.archived)));
  const restCount = liveCategories.filter((c) => !shelved.has(c.id)).length;
  const sectionNamesFor = (id: number, except: string) =>
    sections.filter((s) => s.key !== except && s.categoryIds.includes(id)).map((s) => s.title || 'Untitled section');
  const hasNewIn = sections.some((s) => /^new in$/i.test(s.title.trim()));

  return (
    <div className="hs-editor">
      <ol className="hs-outline" aria-label="Order on the home page">
        {sections.map((s, i) => (
          <li key={s.key} className={s.visible ? '' : 'is-hidden'}>
            <a href={`#hs-${s.key}`}><span className="hs-outline-num">{i + 1}</span>{s.title || 'Untitled section'}</a>
            <span className="hs-outline-count">{s.visible ? `${s.categoryIds.length}` : 'hidden'}</span>
          </li>
        ))}
        <li className="hs-outline-rest">
          <a href="#hs-rest"><span className="hs-outline-num">{sections.length + 1}</span>{restTitle || DEFAULT_REST_TITLE}</a>
          <span className="hs-outline-count">{restCount}</span>
        </li>
      </ol>

      {sections.length === 0 && (
        <p className="hs-empty">No sections yet. The home page shows every category in one list. Add a section below to put chosen categories first.</p>
      )}

      {sections.map((s, i) => (
        <SectionCard
          key={s.key}
          section={s}
          position={i}
          total={sections.length}
          categories={liveCategories}
          byId={byId}
          autoFocus={focusKey === s.key}
          otherSectionsFor={(id) => sectionNamesFor(id, s.key)}
          onChange={(patch) => update(s.key, patch)}
          onMove={(delta) => moveSection(i, delta)}
          onRemove={() => removeSection(s.key)}
        />
      ))}

      <div className="hs-add">
        <span>Add a section:</span>
        {!hasNewIn && <button type="button" className="btn-ghost" onClick={() => addSection('New in')}>+ New in</button>}
        <button type="button" className="btn-ghost" onClick={() => addSection('')}>+ Blank section</button>
      </div>

      <section id="hs-rest" className="card hs-card hs-rest">
        <div className="hs-card-head">
          <span className="hs-num">{sections.length + 1}</span>
          <input className="hs-title" value={restTitle} maxLength={60} aria-label="Title for every other category" placeholder={DEFAULT_REST_TITLE}
            onChange={(e) => { setRestTitle(e.target.value); setStatus(null); }} />
        </div>
        <p className="hs-hint">Always last: the {restCount} {restCount === 1 ? 'category' : 'categories'} not on any shelf above, in catalogue order.</p>
      </section>

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

function SectionCard({
  section, position, total, categories, byId, autoFocus, otherSectionsFor, onChange, onMove, onRemove
}: {
  section: HomeSection;
  position: number;
  total: number;
  categories: Category[];
  byId: Map<number, Category>;
  autoFocus: boolean;
  otherSectionsFor: (id: number) => string[];
  onChange: (patch: Partial<HomeSection>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const ids = section.categoryIds;
  const [picking, setPicking] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocus) return;
    titleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    titleRef.current?.focus();
    // A new section is empty: open the picker straight away.
    setPicking(true);
  }, [autoFocus]);

  const { dragHandleProps, dropTargetProps, dragIndex, overIndex } = useDragReorder((from, to) => onChange({ categoryIds: moveItem(ids, from, to) }));
  const name = section.title || 'this section';

  return (
    <section id={`hs-${section.key}`} className={`card hs-card${section.visible ? '' : ' is-hidden'}`} aria-label={section.title || 'Untitled section'}>
      <div className="hs-card-head">
        <span className="hs-num" title="Position on the home page">{position + 1}</span>
        <input ref={titleRef} className="hs-title" value={section.title} maxLength={60} placeholder="Section title, e.g. New in"
          aria-label="Section title" onChange={(e) => onChange({ title: e.target.value })} />
        <div className="hs-card-tools">
          <button type="button" className="btn-ghost hs-icon" aria-label={`Move ${name} up the page`} disabled={position === 0} onClick={() => onMove(-1)}>↑</button>
          <button type="button" className="btn-ghost hs-icon" aria-label={`Move ${name} down the page`} disabled={position === total - 1} onClick={() => onMove(1)}>↓</button>
        </div>
      </div>

      <div className="hs-card-row">
        <label className="hs-switch">
          <input type="checkbox" checked={section.visible} onChange={(e) => onChange({ visible: e.target.checked })} />
          <span>{section.visible ? 'Shown on /po' : 'Hidden from /po'}</span>
        </label>
        <button type="button" className="hs-link" aria-expanded={showMore} onClick={() => setShowMore((v) => !v)}>
          {showMore ? 'Fewer options' : 'Subtitle & card tag'}
        </button>
        <button type="button" className="hs-link hs-danger" onClick={onRemove}>Remove section</button>
      </div>

      {showMore && (
        <div className="hs-more">
          <label>Subtitle <span>beside the title</span>
            <input value={section.subtitle} maxLength={80} placeholder="e.g. Just added to the catalogue" onChange={(e) => onChange({ subtitle: e.target.value })} />
          </label>
          <label>Card tag <span>on these cards in search results</span>
            <input value={section.cardLabel} maxLength={20} placeholder="e.g. New" onChange={(e) => onChange({ cardLabel: e.target.value })} />
          </label>
        </div>
      )}

      {ids.length === 0 ? (
        <p className="hs-hint">No categories yet. A section with none stays off the home page.</p>
      ) : (
        <ol className="hs-cats">
          {ids.map((id, i) => {
            const c = byId.get(id);
            const also = otherSectionsFor(id);
            return (
              <li
                key={id}
                {...dropTargetProps(i)}
                className={`${dragIndex === i ? 'is-dragging' : ''}${overIndex === i && dragIndex !== i ? ' is-over' : ''}`}
              >
                <span className="hs-grip" {...dragHandleProps(i)} aria-hidden="true" title="Drag to reorder">⋮⋮</span>
                <span className="hs-rank">{i + 1}</span>
                <span className="hs-thumb">{c?.thumb ? <img src={c.thumb} alt="" loading="lazy" /> : <span>{c?.name.charAt(0) ?? '?'}</span>}</span>
                <span className="hs-name">
                  {c ? c.name : `Category #${id} (deleted)`}
                  {c?.archived && <em> · archived, not shown</em>}
                  {also.length > 0 && <small>Also in {also.join(', ')}</small>}
                </span>
                <button type="button" className="btn-ghost hs-icon" aria-label={`Move ${c?.name ?? id} up`} disabled={i === 0} onClick={() => onChange({ categoryIds: moveItem(ids, i, i - 1) })}>↑</button>
                <button type="button" className="btn-ghost hs-icon" aria-label={`Move ${c?.name ?? id} down`} disabled={i === ids.length - 1} onClick={() => onChange({ categoryIds: moveItem(ids, i, i + 1) })}>↓</button>
                <button type="button" className="btn-ghost hs-icon" aria-label={`Remove ${c?.name ?? id} from ${name}`} onClick={() => onChange({ categoryIds: ids.filter((x) => x !== id) })}>✕</button>
              </li>
            );
          })}
        </ol>
      )}

      {picking ? (
        <CategoryPicker
          categories={categories}
          chosen={ids}
          otherSectionsFor={otherSectionsFor}
          onToggle={(id) => onChange({ categoryIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] })}
          onDone={() => setPicking(false)}
        />
      ) : (
        <button type="button" className="btn-ghost hs-add-cats" onClick={() => setPicking(true)}>+ Add categories</button>
      )}
    </section>
  );
}

// Tap to add or take out; the list stays open so several can be added in one go.
function CategoryPicker({ categories, chosen, otherSectionsFor, onToggle, onDone }: {
  categories: Category[];
  chosen: number[];
  otherSectionsFor: (id: number) => string[];
  onToggle: (id: number) => void;
  onDone: () => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = categories.filter((c) => !q || c.name.toLowerCase().includes(q));
  return (
    <div className="hs-picker">
      <div className="hs-picker-head">
        <input type="search" autoFocus value={query} placeholder="Search categories…" aria-label="Search categories" onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className="btn" onClick={onDone}>Done</button>
      </div>
      <ul className="hs-picker-list">
        {shown.map((c) => {
          const on = chosen.includes(c.id);
          const also = otherSectionsFor(c.id);
          return (
            <li key={c.id}>
              <button type="button" className={on ? 'is-on' : ''} aria-pressed={on} onClick={() => onToggle(c.id)}>
                <span className="hs-check" aria-hidden="true">{on ? '✓' : '+'}</span>
                <span className="hs-thumb">{c.thumb ? <img src={c.thumb} alt="" loading="lazy" /> : <span>{c.name.charAt(0)}</span>}</span>
                <span className="hs-name">{c.name}{also.length > 0 && <small>In {also.join(', ')}</small>}</span>
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="hs-hint">No category matches &ldquo;{query.trim()}&rdquo;.</li>}
      </ul>
    </div>
  );
}
