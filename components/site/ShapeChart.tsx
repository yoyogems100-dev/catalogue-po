'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ChartShape } from '@/lib/site/chart-data';
import { Close } from './icons';
import p from './pages.module.css';

// Click a shape → its sizes and the materials that carry it. The selected
// shape is kept in the URL hash (#oval) so a chosen shape can be shared.
export default function ShapeChart({ shapes }: { shapes: ChartShape[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fromHash = () => { const h = decodeURIComponent(location.hash.slice(1)); if (shapes.some((x) => x.slug === h)) setActive(h); };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [shapes]);

  function choose(slug: string | null) {
    setActive(slug);
    history.replaceState(null, '', slug ? `#${slug}` : location.pathname + location.search);
    if (slug) requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }));
  }

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') choose(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  const shape = shapes.find((x) => x.slug === active);
  // Photographed shapes make the chart; the rest are listed by name, so a
  // missing photo never shows up as an empty tile.
  const pictured = shapes.filter((x) => x.img && !broken.has(x.slug));
  const named = shapes.filter((x) => !x.img || broken.has(x.slug));
  const meta = (x: ChartShape) => (x.sizes.length ? `${x.sizes.length} size${x.sizes.length > 1 ? 's' : ''}` : 'Sizes on request');

  return (
    <div className={p.shapeLayout}>
      <div>
        <ul className={p.shapeChart} role="list">
          {pictured.map((x) => (
            <li key={x.slug}>
              <button type="button" className={p.shapeBtn} aria-pressed={x.slug === active} onClick={() => choose(x.slug === active ? null : x.slug)}>
                <span className={p.shapeBtnImg}>
                  <img src={x.img!} alt="" width={72} height={72} loading="lazy" decoding="async" onError={() => setBroken((b) => new Set(b).add(x.slug))} />
                </span>
                <span className={p.shapeBtnName}>{x.name}</span>
                <span className={p.shapeBtnMeta}>{meta(x)}</span>
              </button>
            </li>
          ))}
        </ul>
        {named.length > 0 && (
          <>
            <h2 className={p.moreShapesHead}>More shapes</h2>
            <ul className={p.moreShapes} role="list">
              {named.map((x) => (
                <li key={x.slug}>
                  <button type="button" aria-pressed={x.slug === active} onClick={() => choose(x.slug === active ? null : x.slug)}>
                    {x.name} <span>{meta(x)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div ref={panel} tabIndex={-1} className={`${p.shapePanel} ${shape ? p.shapePanelOpen : ''}`} aria-live="polite" role="region" aria-label={shape ? `${shape.name} sizes` : 'Shape details'}>
        {shape ? (
          <>
            <div className={p.shapePanelHead}>
              {shape.img && <img src={shape.img} alt={`${shape.name} cut`} width={64} height={64} />}
              <h2>{shape.name}</h2>
              <button type="button" className={p.panelClose} onClick={() => choose(null)} aria-label="Close"><Close size={20} /></button>
            </div>
            {shape.sizes.length ? (
              <>
                <h3>Sizes we supply (mm)</h3>
                <ul className={p.sizeChips}>{shape.sizes.map((z) => <li key={z.mm}>{z.mm}</li>)}</ul>
              </>
            ) : <p>Sizes for this shape are confirmed on request.</p>}
            {shape.materials.length > 0 && (
              <>
                <h3>Available in</h3>
                <ul className={p.materialLinks}>{shape.materials.map((m) => <li key={m.href}><Link href={m.href}>{shape.name} {m.name} →</Link></li>)}</ul>
              </>
            )}
            {shape.sizes.length > 0 && <Link className={p.panelLink} href={`/charts/sizes#${shape.slug}`}>Size & carat chart for {shape.name} →</Link>}
          </>
        ) : (
          <p className={p.panelHint}>Choose a shape to see its sizes and the materials it comes in.</p>
        )}
      </div>
      {shape && <button type="button" className={p.panelScrim} aria-label="Close" onClick={() => choose(null)} />}
    </div>
  );
}
