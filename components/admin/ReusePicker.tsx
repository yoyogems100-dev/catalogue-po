'use client';

import { useEffect, useRef, useState } from 'react';
import ShapeIcon from '@/components/ShapeIcon';
import { THREE_VIEW_KEYS } from '@/lib/three-view';
import type { ReuseOptions, ReusePhoto } from '@/lib/reuse-options';

let pending: Promise<ReuseOptions> | null = null;
function loadOptions() {
  pending ||= fetch('/api/admin/reuse-options').then(async (res) => {
    if (!res.ok) { pending = null; throw new Error('Could not load the catalogue photos.'); }
    return res.json();
  });
  return pending;
}

/** Drawing names as people say them: "marquise-checker" -> "Marquise checker". */
function drawingName(key: string) {
  const name = key.replace(/-/g, ' ').replace('taperedbaguette', 'tapered baguette').replace('halfmoon', 'half moon');
  return name[0].toUpperCase() + name.slice(1);
}

type Kind = 'drawing' | 'shape-photo' | 'colour-photo';

/**
 * "Choose from existing": a button that opens a searchable grid of what the
 * catalogue already has -- every shape drawing (with the shapes using it), or
 * every shape or colour photo -- and hands back the one tapped.
 */
export default function ReusePicker({ kind, label = 'Choose existing', current, onPick, disabled, className = 'btn-ghost' }: {
  kind: Kind;
  label?: string;
  /** The drawing key or photo URL in use now, marked in the grid. */
  current?: string | null;
  onPick: (value: string, photo?: ReusePhoto) => void;
  disabled?: boolean;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ReuseOptions | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);
  useEffect(() => {
    if (!open || options) return;
    loadOptions().then(setOptions).catch((e: Error) => setError(e.message));
  }, [open, options]);

  const q = query.trim().toLowerCase();
  const title = kind === 'drawing' ? 'Choose a drawing' : kind === 'shape-photo' ? 'Choose a shape photo' : 'Choose a colour photo';
  const photos = options ? (kind === 'colour-photo' ? options.colourPhotos : options.shapePhotos) : [];

  function pick(value: string, photo?: ReusePhoto) {
    dialog.current?.close();
    onPick(value, photo);
  }

  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={() => { setQuery(''); setOpen(true); }}>{label}</button>
      {open && (
        <dialog ref={dialog} className="reuse-dialog" aria-label={title} onClose={() => setOpen(false)} onClick={(e) => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
          <div className="reuse-head">
            <h2>{title}</h2>
            <button type="button" className="drill-close" aria-label="Close" onClick={() => dialog.current?.close()}>×</button>
          </div>
          <input className="reuse-search" type="search" autoFocus placeholder={kind === 'drawing' ? 'Search drawings or shapes' : 'Search by name'} value={query} onChange={(e) => setQuery(e.target.value)} />
          {error && <p className="cat-tag-error" role="alert">{error}</p>}
          {!options && !error && <p className="fd-note">Loading…</p>}
          {options && (
            <div className="reuse-grid">
              {kind === 'drawing'
                ? THREE_VIEW_KEYS
                    .map((key) => ({ key, users: options.drawings[key] || [] }))
                    .filter(({ key, users }) => !q || drawingName(key).toLowerCase().includes(q) || users.some((u) => u.toLowerCase().includes(q)))
                    .map(({ key, users }) => (
                      <button type="button" key={key} className={`reuse-option${current === key ? ' current' : ''}`} onClick={() => pick(key)}>
                        <span className="reuse-visual reuse-drawing"><ShapeIcon iconKey={key} size={34} /></span>
                        <strong>{drawingName(key)}</strong>
                        <small>{users.length ? users.slice(0, 3).join(', ') + (users.length > 3 ? ` +${users.length - 3}` : '') : 'Not used yet'}</small>
                      </button>
                    ))
                : photos
                    .filter((p) => !q || p.label.toLowerCase().includes(q))
                    .map((p) => (
                      <button type="button" key={p.url} className={`reuse-option${current === p.url ? ' current' : ''}`} onClick={() => pick(p.url, p)}>
                        <span className="reuse-visual"><img src={p.url} alt="" loading="lazy" /></span>
                        <strong>{p.label}</strong>
                      </button>
                    ))}
            </div>
          )}
        </dialog>
      )}
    </>
  );
}
