'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { colourFamily, COLOUR_FAMILIES, splitColourCode, type ChartColour } from '@/lib/colour-chart';

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
  </svg>
);
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

/**
 * "Colour chart" beside the category title. Opens the category's colours as
 * a browsable chart -- every stone's photo, grouped by colour family,
 * searchable by name or code, tap one to see it large -- with the supplier's
 * chart photo one tap away (zoom + download).
 */
export default function ColorChartPreview({ categoryName, colors, chartUrl }: { categoryName: string; colors: ChartColour[]; chartUrl: string | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'swatches' | 'photo'>(colors.length ? 'swatches' : 'photo');
  const [family, setFamily] = useState('');
  const [q, setQ] = useState('');
  const [zoom, setZoom] = useState(1);
  const [focus, setFocus] = useState<number | null>(null);

  const all = useMemo(() => colors.map((c) => ({ ...c, ...splitColourCode(c.name), family: colourFamily(c.hex, c.name) })), [colors]);
  const families = useMemo(() => COLOUR_FAMILIES.map((f) => ({ name: f, count: all.filter((c) => c.family === f).length })).filter((f) => f.count), [all]);
  const shown = useMemo(() => {
    const words = q.toLowerCase().replace(/[-\s]+/g, ' ').trim().split(' ').filter(Boolean);
    return all.filter((c) => (!family || c.family === family) &&
      words.every((w) => `${c.name} ${c.family}`.toLowerCase().replace(/-/g, ' ').includes(w) || c.name.toLowerCase().replace(/-/g, '').includes(w)));
  }, [all, family, q]);
  // Group the shown colours by family, in the families' order.
  const groups = useMemo(() => families.map((f) => ({ ...f, items: shown.filter((c) => c.family === f.name) })).filter((g) => g.items.length), [families, shown]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);
  useEffect(() => {
    if (focus === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setFocus((i) => (i === null ? i : Math.min(flat.length - 1, i + 1)));
      if (e.key === 'ArrowLeft') setFocus((i) => (i === null ? i : Math.max(0, i - 1)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus, flat.length]);

  const current = focus !== null ? flat[focus] : null;

  return (
    <>
      <button type="button" className="btn-ghost size-chart-download" onClick={() => setOpen(true)}>Colour chart</button>
      {open && (
        <dialog
          ref={dialog}
          className="size-chart-dialog cc-dialog"
          aria-labelledby="cc-title"
          onCancel={(e) => { if (focus !== null) { e.preventDefault(); setFocus(null); } }}
          onClose={() => { setOpen(false); setFocus(null); setZoom(1); }}
          onClick={(e) => { if (e.target === e.currentTarget) dialog.current?.close(); }}
        >
          <div className="size-chart-head">
            <h2 id="cc-title">{categoryName} colour chart</h2>
            {chartUrl && (
              <a className="size-chart-icon" href={chartUrl} download target="_blank" rel="noopener noreferrer" aria-label="Download colour chart" title="Download chart">
                <DownloadIcon />
              </a>
            )}
            <button type="button" className="size-chart-icon" aria-label="Close" onClick={() => dialog.current?.close()}><CloseIcon /></button>
          </div>

          {colors.length > 0 && chartUrl && (
            <div className="cc-views" role="tablist" aria-label="Show">
              <button type="button" role="tab" aria-selected={view === 'swatches'} onClick={() => setView('swatches')}>All colours ({colors.length})</button>
              <button type="button" role="tab" aria-selected={view === 'photo'} onClick={() => setView('photo')}>Chart photo</button>
            </div>
          )}

          {view === 'swatches' ? (
            <>
              <div className="cc-tools">
                <input
                  type="search"
                  className="cc-search"
                  placeholder="Search colour or code, e.g. pink, G-42"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Search colours"
                />
                <div className="cc-families" role="group" aria-label="Colour family">
                  <button type="button" aria-pressed={!family} onClick={() => setFamily('')}>All</button>
                  {families.map((f) => (
                    <button type="button" key={f.name} aria-pressed={family === f.name} onClick={() => setFamily(family === f.name ? '' : f.name)}>
                      {f.name} <span>{f.count}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="size-chart-body cc-body">
                {groups.map((g) => (
                  <section key={g.name} className="cc-group" aria-label={g.name}>
                    {!family && <h3>{g.name}</h3>}
                    <ul className="cc-grid">
                      {g.items.map((c) => (
                        <li key={c.id}>
                          <button type="button" className="cc-card" onClick={() => setFocus(flat.indexOf(c))} aria-label={`${c.name}, view larger`}>
                            <span className="cc-photo">
                              {c.refPhotoUrl
                                ? <img src={c.refPhotoUrl} alt="" loading="lazy" />
                                : <span className="cc-dot" style={{ background: c.hex || '#ddd' }} />}
                            </span>
                            {c.code && <span className="cc-code">{c.code}</span>}
                            <span className="cc-name">{c.label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                {!groups.length && <p className="cc-empty">No colour matches “{q}”.</p>}
                <p className="cc-foot">Photos are for reference. Shades vary slightly between batches; our team confirms the exact colour with you.</p>
              </div>
            </>
          ) : (
            <>
              <div className="color-chart-viewer cc-photo-view">
                <div style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
                  {chartUrl && <img src={chartUrl} alt={`${categoryName} colour chart`} />}
                </div>
              </div>
              <div className="cc-zoom">
                <button type="button" disabled={zoom === 1} onClick={() => setZoom((z) => Math.max(1, z - 1))} aria-label="Zoom out">−</button>
                <span aria-live="polite">{zoom === 1 ? 'Fit' : `${zoom}×`}</span>
                <button type="button" disabled={zoom === 4} onClick={() => setZoom((z) => Math.min(4, z + 1))} aria-label="Zoom in">+</button>
              </div>
            </>
          )}

          {current && (
            <div className="cc-lightbox" role="group" aria-label={current.name} onClick={(e) => { if (e.target === e.currentTarget) setFocus(null); }}>
              <div className="cc-lightbox-card">
                <button type="button" className="cc-lightbox-close" aria-label="Back to all colours" onClick={() => setFocus(null)}><CloseIcon /></button>
                <div className="cc-lightbox-photo">
                  {current.refPhotoUrl ? <img src={current.refPhotoUrl} alt={current.name} /> : <span className="cc-dot" style={{ background: current.hex || '#ddd' }} />}
                </div>
                <div className="cc-lightbox-text">
                  {current.code && <span className="cc-code">{current.code}</span>}
                  <strong>{current.label}</strong>
                  <small>{current.family}</small>
                </div>
                <div className="cc-lightbox-nav">
                  <button type="button" disabled={focus === 0} onClick={() => setFocus((i) => (i === null ? i : i - 1))} aria-label="Previous colour">‹</button>
                  <span>{(focus ?? 0) + 1} / {flat.length}</span>
                  <button type="button" disabled={focus === flat.length - 1} onClick={() => setFocus((i) => (i === null ? i : i + 1))} aria-label="Next colour">›</button>
                </div>
              </div>
            </div>
          )}
        </dialog>
      )}
    </>
  );
}
