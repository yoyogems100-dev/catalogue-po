'use client';

import { useEffect, useRef, useState } from 'react';
import FilterLink from './FilterLink';
import { DIMENSIONS, activeCount, filterHref, valueName, type Dimension, type OptionsByDim, type Selection } from '@/lib/site/filters';
import { Chevron, Close } from './icons';
import s from './category.module.css';
import { thumb } from '@/lib/site/optimize';

type Opt = { slug: string; name: string; img?: string | null };
const LABEL: Record<Dimension, string> = { shape: 'Shape', size: 'Size', colour: 'Colour', grade: 'Grade' };

// Sticky Shape · Size · Colour · Grade bar. Every option is a real,
// shareable link that filters in place: no page load, no server request,
// scroll position kept. Desktop: a dropdown per filter.
// Phone: one "Filter (n)" button opening a bottom sheet.
export default function FilterBar({ basePath, options, selection, resultCount }: {
  basePath: string; options: Partial<Record<Dimension, Opt[]>>; selection: Selection; resultCount: number;
}) {
  const [open, setOpen] = useState<Dimension | null>(null);
  const [sheet, setSheet] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dims = DIMENSIONS.filter((d) => (options[d]?.length ?? 0) > 1);
  const count = activeCount(selection);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(null); setSheet(false); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, []);
  useEffect(() => { setOpen(null); }, [selection]);
  // A filtered page moves the photo section, which remounts this bar. Keep
  // the phone sheet open across that so several filters can be picked in a row.
  useEffect(() => {
    try {
      const [path, at] = (sessionStorage.getItem('yoyo-filter-sheet') || '').split('|');
      sessionStorage.removeItem('yoyo-filter-sheet');
      if (path === basePath && Date.now() - Number(at) < 8000) setSheet(true);
    } catch { /* storage unavailable: the sheet simply closes */ }
  }, [basePath]);
  const keepSheet = () => { if (sheet) { try { sessionStorage.setItem('yoyo-filter-sheet', `${basePath}|${Date.now()}`); } catch { /* ignore */ } } };
  const showResults = () => { setSheet(false); document.getElementById('stones')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  useEffect(() => {
    document.documentElement.style.overflow = sheet ? 'hidden' : '';
    return () => { document.documentElement.style.overflow = ''; };
  }, [sheet]);

  if (!dims.length) return null;

  const optionLink = (dim: Dimension, o: Opt) => {
    const on = selection[dim].includes(o.slug);
    return (
      <FilterLink key={o.slug} href={filterHref(basePath, selection, dim, o.slug)} replace onClick={keepSheet}
        className={`${s.opt} ${dim === 'colour' || dim === 'shape' ? s.optImg : ''}`} aria-pressed={on}>
        {o.img && <img {...thumb(o.img, 28)} alt="" width={28} height={28} loading="lazy" />}
        <span>{o.name}</span>
        {on && <span className={s.tick} aria-hidden="true">✓</span>}
      </FilterLink>
    );
  };

  const all = { shape: options.shape || [], size: options.size || [], colour: options.colour || [], grade: options.grade || [] } as OptionsByDim;
  const chips = DIMENSIONS.flatMap((d) => selection[d].map((v) => {
    const name = valueName(d, v, all);
    return name ? (
      <FilterLink key={`${d}-${v}`} href={filterHref(basePath, selection, d, v)} replace className={s.chip} aria-label={`Remove ${name}`}>
        {name} <Close size={14} />
      </FilterLink>
    ) : null;
  }));

  return (
    <>
    <div className={s.filterBar} ref={ref}>
      <div className={s.filterInner}>
        <div className={s.filterDesktop} role="group" aria-label="Filters">
          {dims.map((d) => (
            <div key={d} className={s.filterGroup}>
              <button type="button" className={s.filterBtn} aria-expanded={open === d} onClick={() => setOpen(open === d ? null : d)}>
                {LABEL[d]}{selection[d].length ? <span className={s.badge}>{selection[d].length}</span> : null}<Chevron />
              </button>
              {open === d && (
                <div className={s.popover}>
                  <div className={`${s.optGrid} ${d === 'colour' || d === 'shape' ? s.optGridWide : ''}`}>{options[d]!.map((o) => optionLink(d, o))}</div>
                  {selection[d].length > 0 && <FilterLink href={filterHref(basePath, selection, d, undefined, true)} replace className={s.clearLink}>Clear {LABEL[d].toLowerCase()}</FilterLink>}
                </div>
              )}
            </div>
          ))}
        </div>
        <button type="button" className={s.filterMobileBtn} onClick={() => setSheet(true)} aria-haspopup="dialog">
          Filter{count ? ` (${count})` : ''}
        </button>
        <span className={s.resultCount} aria-live="polite">{resultCount} photo{resultCount === 1 ? '' : 's'}</span>
      </div>
      {count > 0 && (
        <div className={s.chips}>
          {chips}
          <FilterLink href={basePath} replace className={s.clearAll}>Clear all</FilterLink>
        </div>
      )}
    </div>
      {/* Outside the bar: its backdrop-filter would trap this fixed sheet inside it. */}
      {sheet && (
        <div className={s.sheetBackdrop} onClick={() => setSheet(false)}>
          <div className={s.sheet} role="dialog" aria-modal="true" aria-label="Filters" onClick={(e) => e.stopPropagation()}>
            <div className={s.sheetHead}>
              <strong>Filter</strong>
              <button type="button" className={s.sheetClose} onClick={() => setSheet(false)} aria-label="Close filters"><Close /></button>
            </div>
            <div className={s.sheetBody}>
              {dims.map((d) => (
                <section key={d} className={s.sheetSection}>
                  <h3>{LABEL[d]}</h3>
                  <div className={`${s.optGrid} ${d === 'colour' || d === 'shape' ? s.optGridWide : ''}`}>{options[d]!.map((o) => optionLink(d, o))}</div>
                </section>
              ))}
            </div>
            <div className={s.sheetFoot}>
              {count > 0 && <FilterLink href={basePath} replace className={s.sheetClear} onClick={keepSheet}>Clear all</FilterLink>}
              <button type="button" className={s.sheetDone} onClick={showResults}>Show {resultCount} photo{resultCount === 1 ? '' : 's'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
