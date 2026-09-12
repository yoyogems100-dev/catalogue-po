'use client';

import { useEffect, useRef, useState } from 'react';

export default function ColorChart({ url, categoryName }: { url: string; categoryName: string }) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  useEffect(() => { setFailed(false); }, [url]);
  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);
  function close() { dialog.current?.close(); setOpen(false); setZoom(1); opener.current?.focus(); }
  return <div className="category-color-chart">
    <button ref={opener} type="button" className="reference-tile-image" aria-label={`Enlarge ${categoryName} color chart`} onClick={() => setOpen(true)}>
      {failed ? <span>Chart unavailable</span> : <img src={url} alt={`${categoryName} color chart`} onError={() => setFailed(true)} />}
      <span className="po-reference-expand" aria-hidden="true">⤢</span>
    </button>
    <div className="reference-tile-footer"><span>Color chart</span></div>
    {open && <dialog ref={dialog} className="color-chart-dialog" aria-label={`${categoryName} color chart viewer`} onCancel={close} onClose={() => { setOpen(false); setZoom(1); opener.current?.focus(); }}>
      <header><strong>{categoryName} · Color chart</strong><button type="button" autoFocus aria-label="Close color chart" onClick={close}>✕</button></header>
      <div className="color-chart-viewer"><div style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}><img src={url} alt={`${categoryName} color chart`} /></div></div>
      <footer><button type="button" disabled={zoom === 1} onClick={() => setZoom(value => Math.max(1, value - 1))} aria-label="Zoom out color chart">−</button><span aria-live="polite">{zoom === 1 ? 'Fit' : `${zoom}×`}</span><button type="button" disabled={zoom === 4} onClick={() => setZoom(value => Math.min(4, value + 1))} aria-label="Zoom in color chart">+</button><a href={url} target="_blank" rel="noopener noreferrer">Open original ↗</a></footer>
    </dialog>}
  </div>;
}
