'use client';

import { useEffect, useRef, useState } from 'react';

/** Full-screen colour chart with zoom; `onClosed` runs however it is dismissed. */
function ColorChartViewer({ url, categoryName, onClosed }: { url: string; categoryName: string; onClosed: () => void }) {
  const [zoom, setZoom] = useState(1);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="color-chart-dialog" aria-label={`${categoryName} color chart viewer`} onClose={onClosed}>
    <header>
      <strong>{categoryName} · Color chart</strong>
      <a className="color-chart-save" href={url} download target="_blank" rel="noopener noreferrer" aria-label="Download color chart" title="Download">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
      </a>
      <button type="button" autoFocus aria-label="Close color chart" onClick={() => dialog.current?.close()}>✕</button>
    </header>
    <div className="color-chart-viewer"><div style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}><img src={url} alt={`${categoryName} color chart`} /></div></div>
    <footer><button type="button" disabled={zoom === 1} onClick={() => setZoom(value => Math.max(1, value - 1))} aria-label="Zoom out color chart">−</button><span aria-live="polite">{zoom === 1 ? 'Fit' : `${zoom}×`}</span><button type="button" disabled={zoom === 4} onClick={() => setZoom(value => Math.min(4, value + 1))} aria-label="Zoom in color chart">+</button><a href={url} target="_blank" rel="noopener noreferrer">Open original ↗</a></footer>
  </dialog>;
}

/** The chart as a thumbnail tile (beside the reference photos, and in the admin); tap to enlarge. */
export default function ColorChart({ url, categoryName }: { url: string; categoryName: string }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  useEffect(() => { setFailed(false); }, [url]);
  return <div className="category-color-chart">
    <button ref={opener} type="button" className="reference-tile-image" aria-label={`Enlarge ${categoryName} color chart`} onClick={() => setOpen(true)}>
      {failed ? <span>Chart unavailable</span> : <img src={url} alt={`${categoryName} color chart`} onError={() => setFailed(true)} />}
      <span className="po-reference-expand" aria-hidden="true">⤢</span>
    </button>
    <div className="reference-tile-footer"><span>Color chart</span></div>
    {open && <ColorChartViewer url={url} categoryName={categoryName} onClosed={() => { setOpen(false); opener.current?.focus(); }} />}
  </div>;
}
