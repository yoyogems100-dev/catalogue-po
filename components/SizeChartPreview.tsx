'use client';

import { useRef } from 'react';
import type { SizeChartShape } from '@/lib/size-chart';

const fmtDew = (n: number) => `${n.toLocaleString('en-IN', { maximumFractionDigits: 3 })} ct`;
// Shapes with more sizes than this get a full-width card.
const WIDE = 30;

function ShapeCard({ shape, wide = false }: { shape: SizeChartShape; wide?: boolean }) {
  const melee = shape.rows.some((r) => r.pcsPerCt);
  return (
    <section className={`size-chart-card${wide ? ' is-wide' : ''}`}>
      <header>
        {shape.image && <img src={shape.image} alt="" loading="lazy" />}
        <h3>{shape.name}</h3>
        <span>{shape.rows.length} sizes</span>
      </header>
      <div className="size-chart-colhead" aria-hidden="true"><span>Size (mm)</span><span>{melee ? 'DEW / 1ct ≈' : 'DEW'}</span></div>
      <dl className="size-chart-rows">
        {shape.rows.map((r) => (
          <div key={r.size}>
            <dt>{r.size}</dt>
            <dd className={r.pcsPerCt ? 'is-melee' : ''}>{r.pcsPerCt ? `~${r.pcsPerCt} pcs` : r.dew !== null ? fmtDew(r.dew) : '–'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * "Shape & size chart" opens the chart right on the page -- a PDF inside a
 * page doesn't show on most phones -- with a download icon at the top for
 * the PDF itself.
 */
export default function SizeChartPreview({ categoryName, sections, pdfUrl }: { categoryName: string; sections: SizeChartShape[]; pdfUrl: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const hasMelee = sections.some((s) => s.rows.some((r) => r.pcsPerCt));
  return (
    <>
      <button type="button" className="btn-ghost size-chart-download" onClick={() => dialog.current?.showModal()}>
        Shape &amp; size chart
      </button>
      <dialog
        ref={dialog}
        className="size-chart-dialog"
        aria-labelledby="size-chart-title"
        onClick={(e) => { if (e.target === e.currentTarget) dialog.current?.close(); }}
      >
        <div className="size-chart-head">
          <h2 id="size-chart-title">{categoryName} shape &amp; size chart</h2>
          <a className="size-chart-icon" href={pdfUrl} download aria-label="Download PDF" title="Download PDF">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
            </svg>
          </a>
          <button type="button" className="size-chart-icon" aria-label="Close" onClick={() => dialog.current?.close()}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <p className="size-chart-note">
          DEW = approx. diamond-equivalent weight{hasMelee ? ' · 1ct = ~pcs: approx. pieces per carat' : ''}
        </p>
        <div className="size-chart-body">
          {/* A long list (Round) gets the full width with its sizes in side-by-side
              columns, as in the PDF; the other shapes sit in columns below. */}
          {sections.filter((s) => s.rows.length > WIDE).map((s) => <ShapeCard key={s.name} shape={s} wide />)}
          <div className="size-chart-cols">
            {sections.filter((s) => s.rows.length <= WIDE).map((s) => <ShapeCard key={s.name} shape={s} />)}
          </div>
        </div>
      </dialog>
    </>
  );
}
