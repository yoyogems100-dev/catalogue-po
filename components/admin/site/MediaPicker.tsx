'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { mediaSrc, type MediaRow } from '@/lib/site/media-url';
import s from './site-admin.module.css';

// Vercel refuses request bodies over 4.5 MB, and phone photos are often
// bigger. Large images are scaled to the server's own 2400px ceiling in the
// browser first (no visible loss -- the server would do the same), then sent
// one per request.
const UPLOAD_LIMIT = 4 * 1024 * 1024;

export async function prepareForUpload(file: File): Promise<File> {
  if (file.size <= UPLOAD_LIMIT || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    for (const quality of [0.92, 0.85, 0.75]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= UPLOAD_LIMIT) return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    }
  } catch { /* the browser cannot decode it (e.g. HEIC outside Safari); let the server say so */ }
  return file;
}

async function sendOne(url: string, file: File, extra?: Record<string, string>) {
  const prepared = await prepareForUpload(file);
  if (prepared.size > UPLOAD_LIMIT + 400_000) return { errors: [`${file.name}: too large to upload -- export it as a JPG under 4 MB.`] };
  const form = new FormData();
  form.append('file', prepared);
  Object.entries(extra || {}).forEach(([k, v]) => form.append(k, v));
  try {
    const res = await fetch(url, { method: 'POST', body: form });
    const body = await res.json().catch(() => ({}));
    return res.ok || body.created ? body : { errors: [body.error || `${file.name}: upload failed.`] };
  } catch {
    return { errors: [`${file.name}: upload failed -- check your connection and try again.`] };
  }
}

/** Upload files to the library; resolves with the created rows. */
export async function uploadMedia(files: File[], assign?: { target_type: string; target_id: number }) {
  const created: MediaRow[] = [];
  const errors: string[] = [];
  const extra = assign ? { target_type: assign.target_type, target_id: String(assign.target_id) } : undefined;
  // Two at a time: quick, without flooding a phone's upload link.
  for (let i = 0; i < files.length; i += 2) {
    const results = await Promise.all(files.slice(i, i + 2).map((f) => sendOne('/api/admin/site/media', f, extra)));
    for (const r of results) { created.push(...(r.created || [])); errors.push(...(r.errors || [])); }
  }
  return { created, errors };
}

/** Replace one library image's file, keeping its id and every use. */
export async function replaceMedia(id: number, file: File): Promise<{ media?: MediaRow; error?: string }> {
  const prepared = await prepareForUpload(file);
  const form = new FormData();
  form.append('file', prepared);
  try {
    const res = await fetch(`/api/admin/site/media/${id}`, { method: 'POST', body: form });
    const body = await res.json().catch(() => ({}));
    return res.ok ? { media: body.media } : { error: body.error || 'Could not replace.' };
  } catch {
    return { error: 'Could not replace -- check your connection.' };
  }
}

export function Thumb({ media, size = 160 }: { media: MediaRow; size?: number }) {
  return <img src={mediaSrc(media, 480)} alt={media.alt} width={size} height={size} loading="lazy" className={s.thumbImg} />;
}

/** Modal to choose an image from the library, or upload a new one. */
export default function MediaPicker({ open, onClose, onPick, multiple = false }: {
  open: boolean; onClose: () => void; onPick: (media: MediaRow[]) => void; multiple?: boolean;
}) {
  const [items, setItems] = useState<MediaRow[]>([]);
  const [q, setQ] = useState('');
  const [chosen, setChosen] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (query: string) => {
    const res = await fetch(`/api/admin/site/media?q=${encodeURIComponent(query)}`);
    const body = await res.json().catch(() => ({}));
    setItems(body.media || []);
  }, []);

  useEffect(() => { if (open) { setChosen([]); setMessage(''); load(''); } }, [open, load]);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
  }, [q, open, load]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setMessage('Uploading…');
    const { created, errors } = await uploadMedia(Array.from(files));
    setBusy(false);
    setItems((prev) => [...created, ...prev]);
    setChosen((prev) => multiple ? [...created.map((m) => m.id), ...prev] : created.slice(0, 1).map((m) => m.id));
    setMessage(errors.length ? errors.join(' ') : `${created.length} uploaded.`);
  }

  function toggle(id: number) {
    setChosen((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : multiple ? [...prev, id] : [id]);
  }

  if (!open) return null;
  return (
    <div className={s.modalBackdrop} onClick={onClose}>
      <div className={s.modal} role="dialog" aria-modal="true" aria-label="Choose an image" onClick={(e) => e.stopPropagation()}>
        <div className={s.modalHead}>
          <h2>Choose {multiple ? 'images' : 'an image'}</h2>
          <button type="button" className={s.iconBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className={s.modalTools}>
          <input type="search" placeholder="Search by description or tag" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="button" className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>Upload new</button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
        </div>
        {message && <p className={s.note} role="status">{message}</p>}
        <div className={s.pickGrid}>
          {items.map((m) => (
            <button key={m.id} type="button" className={`${s.pickItem} ${chosen.includes(m.id) ? s.picked : ''}`} onClick={() => toggle(m.id)} aria-pressed={chosen.includes(m.id)}>
              <Thumb media={m} />
              <span>{m.alt || 'No description'}</span>
            </button>
          ))}
          {!items.length && <p className={s.note}>No images yet. Upload one to get started.</p>}
        </div>
        <div className={s.modalFoot}>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn" disabled={!chosen.length} onClick={() => { onPick(chosen.map((id) => items.find((m) => m.id === id)!).filter(Boolean)); onClose(); }}>
            Use {chosen.length > 1 ? `${chosen.length} images` : 'image'}
          </button>
        </div>
      </div>
    </div>
  );
}
