'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Hole = { x: number; y: number; r: number };
type Backdrop = 'black' | 'white';
export type DrillState = { holes: Hole[]; backdrop: Backdrop | null } | null;

const DEFAULT_R = 0.055;
const MIN_R = 0.02;
const MAX_R = 0.2;
const MAX_HOLES = 6;

/**
 * Hole Punched Stones: drill holes into a shape's gemstone photo. Tap the
 * stone to add a hole, drag one to move it, pick one to resize or erase it.
 * Preview shows exactly what the site will show; Save makes it the shape's
 * photo (dropdown, cart, checkout -- no background) and the category's
 * explore photo of it (in a black or white light box).
 */
export default function DrillHoleEditor({ categoryId, shapeId, shapeName, baseUrl, drill }: {
  categoryId: number; shapeId: number; shapeName: string; baseUrl: string | null; drill: DrillState;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ index: number; moved: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const [holes, setHoles] = useState<Hole[]>(drill?.holes || []);
  const [backdrop, setBackdrop] = useState<Backdrop>(drill?.backdrop || 'black');
  const [selected, setSelected] = useState<number | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [preview, setPreview] = useState<{ cutout: string; lightBox: string } | null>(null);
  const [busy, setBusy] = useState<'preview' | 'save' | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);

  function start() {
    setHoles(drill?.holes || []);
    setBackdrop(drill?.backdrop || 'black');
    setSelected(null);
    setPreview(null);
    setMessage('');
    setOpen(true);
  }

  const side = Math.min(box.w, box.h);
  function pointAt(e: React.PointerEvent) {
    const rect = stage.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)), y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)) };
  }
  function edit(next: Hole[]) { setHoles(next); setPreview(null); }

  function onStageDown(e: React.PointerEvent) {
    if (e.target !== e.currentTarget && !(e.target as Element).classList.contains('drill-photo')) return;
    if (holes.length >= MAX_HOLES) { setMessage(`Up to ${MAX_HOLES} holes.`); return; }
    const p = pointAt(e);
    const r = selected !== null ? holes[selected]?.r ?? DEFAULT_R : holes.at(-1)?.r ?? DEFAULT_R;
    edit([...holes, { ...p, r }]);
    setSelected(holes.length);
    setMessage('');
  }
  function onHoleDown(e: React.PointerEvent, index: number) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragging.current = { index, moved: false };
    setSelected(index);
  }
  function onMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const p = pointAt(e);
    dragging.current.moved = true;
    edit(holes.map((h, i) => (i === dragging.current!.index ? { ...h, ...p } : h)));
  }
  function onUp() { dragging.current = null; }

  async function send(previewOnly: boolean) {
    setBusy(previewOnly ? 'preview' : 'save');
    setMessage('');
    const response = await fetch(`/api/admin/categories/${categoryId}/drill-holes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shape_id: shapeId, holes, backdrop, preview: previewOnly })
    });
    const data = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) { setMessage(data.error || 'Something went wrong. Please try again.'); return; }
    if (previewOnly) { setPreview(data); return; }
    dialog.current?.close();
    router.refresh();
  }

  const current = selected !== null ? holes[selected] : null;

  return (
    <>
      <button type="button" className="shape-reference-upload drill-open" disabled={!baseUrl} onClick={start}
        title={baseUrl ? 'Add, move or erase drill holes' : 'Add a gemstone photo first'}>
        {drill?.holes?.length ? 'Edit holes' : 'Drill holes'}
      </button>
      {open && baseUrl && (
        <dialog ref={dialog} className="drill-dialog" aria-labelledby={`drill-title-${shapeId}`} onClose={() => setOpen(false)}>
          <div className="drill-head">
            <h2 id={`drill-title-${shapeId}`}>{shapeName}: drill holes</h2>
            <button type="button" className="drill-close" aria-label="Close" onClick={() => dialog.current?.close()}>×</button>
          </div>
          <p className="drill-help">Tap the stone to add a hole. Drag a hole to move it; pick one to resize or erase it.</p>

          <div className="drill-body">
            <div className="drill-stage-wrap">
              <div
                ref={stage}
                className="drill-stage"
                onPointerDown={onStageDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              >
                <img
                  className="drill-photo"
                  src={baseUrl}
                  alt={`${shapeName} gemstone`}
                  draggable={false}
                  onLoad={(e) => setBox({ w: e.currentTarget.clientWidth, h: e.currentTarget.clientHeight })}
                />
                {side > 0 && holes.map((h, i) => (
                  <button
                    type="button"
                    key={i}
                    className={`drill-hole${selected === i ? ' selected' : ''}`}
                    style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%`, width: h.r * side * 2, height: h.r * side * 2 }}
                    aria-label={`Hole ${i + 1}`}
                    onPointerDown={(e) => onHoleDown(e, i)}
                  />
                ))}
              </div>
            </div>

            <div className="drill-controls">
              <div className="drill-row">
                <span>Explore photo backdrop</span>
                <div className="cat-badge-toggle" role="group" aria-label="Light box backdrop">
                  {(['black', 'white'] as const).map((b) => (
                    <button type="button" key={b} className={backdrop === b ? 'active' : ''} aria-pressed={backdrop === b} onClick={() => { setBackdrop(b); setPreview(null); }}>
                      {b === 'black' ? 'Black velvet' : 'White'}
                    </button>
                  ))}
                </div>
              </div>

              {current ? (
                <div className="drill-row">
                  <label htmlFor={`drill-size-${shapeId}`}>Hole {selected! + 1} size</label>
                  <input
                    id={`drill-size-${shapeId}`}
                    type="range"
                    min={MIN_R}
                    max={MAX_R}
                    step={0.005}
                    value={current.r}
                    onChange={(e) => edit(holes.map((h, i) => (i === selected ? { ...h, r: Number(e.target.value) } : h)))}
                  />
                  <button type="button" className="btn-ghost" onClick={() => { edit(holes.filter((_, i) => i !== selected)); setSelected(null); }}>Erase hole</button>
                </div>
              ) : (
                <p className="drill-note">{holes.length ? 'Pick a hole to resize or erase it.' : 'No holes yet.'}</p>
              )}
              {holes.length > 1 && <button type="button" className="btn-ghost drill-clear" onClick={() => { edit([]); setSelected(null); }}>Erase all holes</button>}

              {preview && (
                <div className="drill-preview">
                  <figure><img src={preview.cutout} alt="" /><figcaption>Dropdown &amp; checkout</figcaption></figure>
                  <figure><img src={preview.lightBox} alt="" /><figcaption>Explore photo</figcaption></figure>
                </div>
              )}
              {message && <p className="admin-inline-status" role="status">{message}</p>}

              <div className="drill-actions">
                <button type="button" className="btn-ghost" disabled={busy !== null} onClick={() => send(true)}>{busy === 'preview' ? 'Preparing…' : 'Preview'}</button>
                <button type="button" className="btn" disabled={busy !== null} onClick={() => send(false)}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
              </div>
              <p className="drill-note">Save sets this shape’s photo in the dropdown and checkout, and {drill?.holes ? 'updates' : 'adds'} its explore photo.</p>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
