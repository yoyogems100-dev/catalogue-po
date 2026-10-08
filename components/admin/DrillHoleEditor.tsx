'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import HoleDots from '@/components/HoleDots';
import { HOLE_COUNTS, MAX_HOLES, holesLabel, type Backdrop, type DrillHole, type DrillRecord, type HoleCount } from '@/lib/drill-data';

const DEFAULT_R = 0.055;
const MIN_R = 0.02;
const MAX_R = 0.2;

/**
 * Hole Punched Stones: drill holes into a shape's gemstone photo. Tap the
 * stone to add a hole, drag one to move it, pick one to resize or erase it.
 * A stone has a photo for each number of holes a customer can choose (1, 2,
 * 3); how many holes are placed decides which one a save makes. Preview shows
 * exactly what the site will show; Save makes it that photo (dropdown, cart,
 * checkout -- no background) and the matching explore photo (black or white
 * light box).
 */
export default function DrillHoleEditor({ categoryId, shapeId, shapeName, baseUrl, drill }: {
  categoryId: number; shapeId: number; shapeName: string; baseUrl: string | null; drill: DrillRecord | null;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [variants, setVariants] = useState<DrillRecord['variants']>(drill?.variants || {});
  const [holes, setHoles] = useState<DrillHole[]>([]);
  const [backdrop, setBackdrop] = useState<Backdrop>('black');
  const [selected, setSelected] = useState<number | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [preview, setPreview] = useState<{ cutout: string; lightBox: string } | null>(null);
  const [busy, setBusy] = useState<'preview' | 'save' | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => setVariants(drill?.variants || {}), [drill]);
  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);

  const savedCounts = HOLE_COUNTS.filter((n) => variants[`${n}`]);

  /** Show one hole count's photo for editing; one not made yet starts from the
   *  holes of the next smaller one, so adding a 2nd hole keeps the 1st. */
  function load(n: HoleCount, from: DrillRecord['variants'] = variants) {
    const v = from[`${n}`];
    const below = [...HOLE_COUNTS].reverse().find((m) => m < n && from[`${m}`]);
    setHoles(v ? v.holes : below ? from[`${below}`]!.holes : []);
    setBackdrop(v?.backdrop || (below && from[`${below}`]?.backdrop) || 'black');
    setSelected(null);
    setPreview(null);
    setMessage(v ? '' : `Place ${holesLabel(n)} for the ${holesLabel(n)} photo.`);
  }
  function start() {
    load(savedCounts[0] ?? 1);
    setOpen(true);
  }

  const side = Math.min(box.w, box.h);
  function pointAt(e: React.PointerEvent) {
    const rect = stage.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)), y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)) };
  }
  function edit(next: DrillHole[]) { setHoles(next); setPreview(null); setMessage(''); }

  function onStageDown(e: React.PointerEvent) {
    if (e.target !== e.currentTarget && !(e.target as Element).classList.contains('drill-photo')) return;
    if (holes.length >= MAX_HOLES) { setMessage(`A stone has at most ${MAX_HOLES} holes. Erase one to place it elsewhere.`); return; }
    const r = (selected !== null ? holes[selected]?.r : holes.at(-1)?.r) ?? DEFAULT_R;
    edit([...holes, { ...pointAt(e), r }]);
    setSelected(holes.length);
  }
  function onHoleDown(e: React.PointerEvent, index: number) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragging.current = index;
    setSelected(index);
  }
  function onMove(e: React.PointerEvent) {
    if (dragging.current === null) return;
    const p = pointAt(e);
    edit(holes.map((h, i) => (i === dragging.current ? { ...h, ...p } : h)));
  }
  function onUp() { dragging.current = null; }

  async function send(previewOnly: boolean) {
    if (!holes.length) { setMessage('Tap the stone to place at least one hole.'); return; }
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
    setVariants(data.drill?.variants || variants);
    setMessage(`Saved as the ${holesLabel(holes.length)} photo, with its explore photo.`);
    router.refresh();
  }

  const current = selected !== null ? holes[selected] : null;
  const target = holes.length as HoleCount | 0;

  return (
    <>
      <button type="button" className="shape-reference-upload drill-open" disabled={!baseUrl} onClick={start}
        title={baseUrl ? 'Add, move or erase drill holes' : 'Add a gemstone photo first'}>
        {savedCounts.length ? `Holes: ${savedCounts.join(' · ')}` : 'Drill holes'}
      </button>
      {open && baseUrl && (
        <dialog ref={dialog} className="drill-dialog" aria-labelledby={`drill-title-${shapeId}`} onClose={() => setOpen(false)}>
          <div className="drill-head">
            <h2 id={`drill-title-${shapeId}`}>{shapeName}: drill holes</h2>
            <button type="button" className="drill-close" aria-label="Close" onClick={() => dialog.current?.close()}>×</button>
          </div>

          <div className="drill-slots" role="group" aria-label="Photo for each number of holes">
            {HOLE_COUNTS.map((n) => {
              const v = variants[`${n}`];
              return (
                <button type="button" key={n} className={`drill-slot${target === n ? ' active' : ''}`} aria-pressed={target === n} onClick={() => load(n)}>
                  <span className="drill-slot-photo">
                    {v?.url ? <img src={v.url} alt="" /> : <HoleDots count={n} />}
                  </span>
                  <span className="drill-slot-label">{holesLabel(n)}</span>
                  <span className="drill-slot-state">{v ? 'Saved' : 'Not made yet'}</span>
                </button>
              );
            })}
          </div>
          <p className="drill-help">Tap the stone to add a hole (up to {MAX_HOLES}). Drag to move; pick one to resize or erase. The number of holes decides which photo you’re making.</p>

          <div className="drill-body">
            <div className="drill-stage-wrap">
              <div ref={stage} className="drill-stage" onPointerDown={onStageDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
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
              <p className={`drill-target${target ? '' : ' empty'}`}>
                {target ? <>Making the <strong>{holesLabel(target)}</strong> photo{variants[`${target}`] ? ' (replaces the saved one)' : ''}</> : 'Tap the stone to place a hole'}
              </p>

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
                  <input id={`drill-size-${shapeId}`} type="range" min={MIN_R} max={MAX_R} step={0.005} value={current.r}
                    onChange={(e) => edit(holes.map((h, i) => (i === selected ? { ...h, r: Number(e.target.value) } : h)))} />
                  <button type="button" className="btn-ghost" onClick={() => { edit(holes.filter((_, i) => i !== selected)); setSelected(null); }}>Erase hole</button>
                </div>
              ) : holes.length > 0 && <p className="drill-note">Pick a hole to resize or erase it.</p>}
              {holes.length > 1 && <button type="button" className="btn-ghost drill-clear" onClick={() => { edit([]); setSelected(null); }}>Erase all holes</button>}

              {preview && (
                <div className="drill-preview">
                  <figure><img src={preview.cutout} alt="" /><figcaption>Dropdown &amp; checkout</figcaption></figure>
                  <figure><img src={preview.lightBox} alt="" /><figcaption>Explore photo</figcaption></figure>
                </div>
              )}
              {message && <p className="admin-inline-status" role="status">{message}</p>}

              <div className="drill-actions">
                <button type="button" className="btn-ghost" disabled={busy !== null || !holes.length} onClick={() => send(true)}>{busy === 'preview' ? 'Preparing…' : 'Preview'}</button>
                <button type="button" className="btn" disabled={busy !== null || !holes.length} onClick={() => send(false)}>{busy === 'save' ? 'Saving…' : target ? `Save ${holesLabel(target)} photo` : 'Save'}</button>
              </div>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
