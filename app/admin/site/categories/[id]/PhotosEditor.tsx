'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sortable from '@/components/admin/site/Sortable';
import MediaPicker, { Thumb, uploadMedia } from '@/components/admin/site/MediaPicker';
import { MediaDetail, type MediaLink, type Options } from '../../media/MediaLibrary';
import type { MediaRow } from '@/lib/site/media-url';
import s from '@/components/admin/site/site-admin.module.css';

// The website's own photos for one category. They are copies: removing or
// deleting one here never touches the /po catalogue, and new /po photos only
// appear here when added with "Add from /po catalogue".

type PoPhoto = { id: number; src: string | null; category: string; onPage: boolean };

export default function PhotosEditor({ siteCategoryId, initial, links: initialLinks, options, childPhotoCount, hasSources }: {
  siteCategoryId: number; initial: MediaRow[]; links: MediaLink[]; options: Options; childPhotoCount: number; hasSources: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<MediaRow[]>(initial);
  const [links, setLinks] = useState<MediaLink[]>(initialLinks);
  const [picking, setPicking] = useState(false);
  const [fromPo, setFromPo] = useState(false);
  const [open, setOpen] = useState<MediaRow | null>(null);
  const [message, setMessage] = useState('');
  const [over, setOver] = useState(false);

  useEffect(() => { setItems(initial); setLinks(initialLinks); }, [initial, initialLinks]);

  async function persist(next: MediaRow[], done = 'Saved.') {
    const before = items;
    setItems(next);
    const res = await fetch(`/api/admin/site/categories/${siteCategoryId}/gallery`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ media_ids: next.map((m) => m.id) })
    });
    if (!res.ok) { setItems(before); setMessage((await res.json().catch(() => ({}))).error || 'Could not save.'); return; }
    setMessage(done);
  }

  async function upload(files: File[]) {
    if (!files.length) return;
    setMessage('Uploading…');
    const { created, errors } = await uploadMedia(files, { target_type: 'site_category', target_id: siteCategoryId });
    setItems((prev) => [...prev, ...created]);
    setLinks((prev) => [...prev, ...created.map((m) => ({ media_id: m.id, target_type: 'site_category', target_id: siteCategoryId }))]);
    setMessage(errors.length ? errors.join(' ') : `${created.length} added. Tap “Tags” on each to set its colour, shape and size for the filters.`);
  }

  const name = (type: keyof Options, id: number) => options[type].find((o) => o.id === id)?.name;
  function summary(id: number) {
    const mine = links.filter((l) => l.media_id === id && l.target_type !== 'site_category');
    const parts = (['color', 'shape', 'size', 'grade'] as const).flatMap((t) =>
      mine.filter((l) => l.target_type === t).map((l) => (t === 'size' ? `${name(t, l.target_id)}mm` : name(t, l.target_id))).filter(Boolean));
    return parts.join(' · ');
  }

  return (
    <>
      <p className={s.note}>
        The photos on this website page, in this order. They are the website’s own copies — removing one here never changes the /po catalogue, and new /po photos are only added when you choose them below.
        {childPhotoCount > 0 && <> The page also shows {childPhotoCount} photo{childPhotoCount === 1 ? '' : 's'} from its sub-categories, after these.</>}
      </p>
      <label
        className={`${s.dropzone} ${over ? s.dropzoneActive : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); upload(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))); }}
      >
        <strong>Drop photos here, or tap to choose</strong>
        <span className={s.help}>JPG, PNG, WebP or HEIC. Converted to WebP with phone-sized copies automatically.</span>
        <input type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { upload(Array.from(e.target.files || [])); e.target.value = ''; }} />
      </label>
      <div className={s.toolbar}>
        <button type="button" className="btn-ghost" onClick={() => setPicking(true)}>Add from website library</button>
        {hasSources && <button type="button" className="btn-ghost" onClick={() => setFromPo(true)}>Copy from /po catalogue</button>}
        <span className={s.help}>{items.length} photo{items.length === 1 ? '' : 's'}</span>
      </div>
      {message && <p className={s.note} role="status">{message}</p>}
      {!items.length && <p className={s.note}>No photos yet. {childPhotoCount ? '' : 'The page shows a “Request catalogue” note instead.'}</p>}
      <Sortable
        layout="grid"
        items={items}
        getId={(m) => m.id}
        label={(m) => m.alt || `photo ${m.id}`}
        onReorder={(next) => persist(next, 'Order saved.')}
        render={(m) => {
          const tags = summary(m.id);
          return (
            <div>
              <Thumb media={m} />
              <p className={s.help} style={{ margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tags}>
                {tags || <span className={s.mediaWarn}>No filter tags</span>}
              </p>
              <div className={s.listItemHead} style={{ marginTop: 2 }}>
                <button type="button" className={s.linkBtn} style={{ color: 'var(--navy)' }} onClick={() => setOpen(m)}>Tags</button>
                <button type="button" className={s.linkBtn} onClick={() => persist(items.filter((x) => x.id !== m.id), 'Removed from this page. It stays in the website library.')}>Remove</button>
              </div>
            </div>
          );
        }}
      />
      <MediaPicker open={picking} multiple onClose={() => setPicking(false)}
        onPick={async (rows) => { await persist([...items, ...rows.filter((r) => !items.some((x) => x.id === r.id))], 'Added.'); router.refresh(); }} />
      {fromPo && <PoPicker siteCategoryId={siteCategoryId} onClose={() => setFromPo(false)} onDone={(msg) => { setFromPo(false); setMessage(msg); router.refresh(); }} />}
      {open && (
        <MediaDetail
          media={open}
          links={links.filter((l) => l.media_id === open.id)}
          options={options}
          onClose={() => setOpen(null)}
          onSaved={(m, l) => {
            setLinks([...links.filter((x) => x.media_id !== m.id), ...l]);
            const stillHere = l.some((x) => x.target_type === 'site_category' && x.target_id === siteCategoryId);
            setItems(stillHere ? items.map((x) => (x.id === m.id ? m : x)) : items.filter((x) => x.id !== m.id));
            setOpen(stillHere ? m : null);
          }}
          onDeleted={(id) => { setItems(items.filter((x) => x.id !== id)); setLinks(links.filter((x) => x.media_id !== id)); setOpen(null); setMessage('Photo deleted from the website.'); }}
        />
      )}
    </>
  );
}

function PoPicker({ siteCategoryId, onClose, onDone }: { siteCategoryId: number; onClose: () => void; onDone: (message: string) => void }) {
  const [photos, setPhotos] = useState<PoPhoto[] | null>(null);
  const [chosen, setChosen] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch(`/api/admin/site/categories/${siteCategoryId}/po-photos`).then((r) => r.json()).then((b) => setPhotos(b.photos || []))
      .catch(() => setMessage('Could not load the /po photos.'));
  }, [siteCategoryId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const available = (photos || []).filter((p) => !p.onPage);
  async function copy() {
    setBusy(true);
    let linked = 0;
    const errors: string[] = [];
    for (let i = 0; i < chosen.length; i += 12) {
      setMessage(`Copying ${Math.min(i + 12, chosen.length)} of ${chosen.length}…`);
      const res = await fetch(`/api/admin/site/categories/${siteCategoryId}/po-photos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photo_ids: chosen.slice(i, i + 12) })
      });
      const body = await res.json().catch(() => ({}));
      linked += body.linked || 0;
      errors.push(...(body.errors || (res.ok ? [] : [body.error || 'Copy failed.'])));
    }
    setBusy(false);
    if (errors.length && !linked) { setMessage(errors.join(' ')); return; }
    onDone(`${linked} photo${linked === 1 ? '' : 's'} copied from /po.${errors.length ? ' ' + errors.join(' ') : ''}`);
  }

  return (
    <div className={s.modalBackdrop} onClick={() => !busy && onClose()}>
      <div className={s.modal} role="dialog" aria-modal="true" aria-label="Copy photos from the /po catalogue" onClick={(e) => e.stopPropagation()}>
        <div className={s.modalHead}>
          <h2>Copy from /po catalogue</h2>
          <button type="button" className={s.iconBtn} onClick={onClose} disabled={busy} aria-label="Close">✕</button>
        </div>
        <p className={s.note} style={{ marginTop: 0 }}>Photos of the /po categories this page is linked to. The website gets its own copy with the same tags; the /po photo is not changed.</p>
        {message && <p className={s.note} role="status">{message}</p>}
        {!photos ? <p className={s.note}>Loading…</p> : !photos.length ? <p className={s.note}>The linked /po categories have no photos.</p> : (
          <div className={s.pickGrid}>
            {photos.map((p) => (
              <button key={p.id} type="button" disabled={p.onPage || busy} aria-pressed={chosen.includes(p.id)}
                className={`${s.pickItem} ${chosen.includes(p.id) ? s.picked : ''}`} style={p.onPage ? { opacity: 0.45, cursor: 'default' } : undefined}
                onClick={() => setChosen((prev) => (prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]))}>
                {p.src ? <img src={p.src} alt="" width={160} height={160} loading="lazy" className={s.thumbImg} /> : <div className={s.thumbImg} />}
                <span>{p.onPage ? 'Already on this page' : p.category}</span>
              </button>
            ))}
          </div>
        )}
        <div className={s.modalFoot}>
          {available.length > 0 && (
            <button type="button" className="btn-ghost" style={{ marginRight: 'auto' }} disabled={busy}
              onClick={() => setChosen(chosen.length === available.length ? [] : available.map((p) => p.id))}>
              {chosen.length === available.length ? 'Clear' : `Select all ${available.length}`}
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn" disabled={busy || !chosen.length} onClick={copy}>Copy {chosen.length || ''} to website</button>
        </div>
      </div>
    </div>
  );
}
