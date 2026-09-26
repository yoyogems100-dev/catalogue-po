'use client';

import { useState } from 'react';
import Sortable from '@/components/admin/site/Sortable';
import MediaPicker, { Thumb, uploadMedia } from '@/components/admin/site/MediaPicker';
import type { MediaRow } from '@/lib/site/media-url';
import s from '@/components/admin/site/site-admin.module.css';

export default function GalleryEditor({ siteCategoryId, initial }: { siteCategoryId: number; initial: MediaRow[] }) {
  const [items, setItems] = useState<MediaRow[]>(initial);
  const [picking, setPicking] = useState(false);
  const [message, setMessage] = useState('');
  const [over, setOver] = useState(false);

  async function persist(next: MediaRow[]) {
    const before = items;
    setItems(next);
    const res = await fetch(`/api/admin/site/categories/${siteCategoryId}/gallery`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ media_ids: next.map((m) => m.id) })
    });
    if (!res.ok) { setItems(before); setMessage((await res.json().catch(() => ({}))).error || 'Could not save.'); return; }
    setMessage('Gallery saved.');
  }

  async function upload(files: File[]) {
    if (!files.length) return;
    setMessage('Uploading…');
    const { created, errors } = await uploadMedia(files, { target_type: 'site_category', target_id: siteCategoryId });
    setItems((prev) => [...prev, ...created]);
    setMessage(errors.length ? errors.join(' ') : `${created.length} added to the gallery.`);
  }

  return (
    <>
      <p className={s.note}>These images appear in the page gallery, in this order. If the gallery is empty, the page shows photos from its linked catalogue categories instead.</p>
      <label
        className={`${s.dropzone} ${over ? s.dropzoneActive : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); upload(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))); }}
      >
        <strong>Drop images here, or tap to choose</strong>
        <span className={s.help}>JPG, PNG, WebP or HEIC. Converted to WebP with phone-sized copies automatically.</span>
        <input type="file" accept="image/*" multiple hidden onChange={(e) => { upload(Array.from(e.target.files || [])); e.target.value = ''; }} />
      </label>
      <div className={s.toolbar}><button type="button" className="btn-ghost" onClick={() => setPicking(true)}>Add from library</button></div>
      <Sortable
        layout="grid"
        items={items}
        getId={(m) => m.id}
        label={(m) => m.alt || `image ${m.id}`}
        onReorder={persist}
        render={(m) => (
          <div>
            <Thumb media={m} />
            <div className={s.listItemHead} style={{ marginTop: 4 }}>
              <span title={m.alt}>{m.alt ? m.alt.slice(0, 22) : <span className={s.mediaWarn}>No description</span>}</span>
              <button type="button" className={s.linkBtn} onClick={() => persist(items.filter((x) => x.id !== m.id))}>Remove</button>
            </div>
          </div>
        )}
      />
      {message && <p className={s.note} role="status">{message}</p>}
      <MediaPicker open={picking} multiple onClose={() => setPicking(false)}
        onPick={(rows) => persist([...items, ...rows.filter((r) => !items.some((x) => x.id === r.id))])} />
    </>
  );
}
