'use client';

import { useMemo, useRef, useState } from 'react';
import { uploadMedia, replaceMedia, Thumb } from '@/components/admin/site/MediaPicker';
import { mediaSrc, type MediaRow } from '@/lib/site/media-url';
import s from '@/components/admin/site/site-admin.module.css';

type Link = { media_id: number; target_type: string; target_id: number };
type Option = { id: number; name: string; shape_id?: number };
export type Options = Record<'site_category' | 'color' | 'shape' | 'size' | 'grade', Option[]>;
export type MediaLink = Link;

// A photo is shown on the website categories it is added to; its colour,
// shape, size and grade tags drive the filters on those pages.
const TYPE_LABEL: Record<keyof Options, string> = { site_category: 'Shown on category', color: 'Colour', shape: 'Shape', size: 'Size', grade: 'Grade' };

export default function MediaLibrary({ initial, links: initialLinks, options }: { initial: MediaRow[]; links: Link[]; options: Options }) {
  const [items, setItems] = useState(initial);
  const [links, setLinks] = useState(initialLinks);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'unused' | 'noalt'>('all');
  const [open, setOpen] = useState<MediaRow | null>(null);
  const [message, setMessage] = useState('');
  const [over, setOver] = useState(false);

  const usage = (id: number) => links.filter((l) => l.media_id === id);
  const onCategories = (id: number) => links.filter((l) => l.media_id === id && l.target_type === 'site_category').length;
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((m) => {
      if (filter === 'unused' && onCategories(m.id)) return false;
      if (filter === 'noalt' && m.alt.trim()) return false;
      return !needle || m.alt.toLowerCase().includes(needle) || (m.tags || []).some((t) => t.includes(needle));
    });
  }, [items, links, q, filter]);

  async function upload(files: File[]) {
    if (!files.length) return;
    setMessage(`Uploading ${files.length} image${files.length > 1 ? 's' : ''}…`);
    const { created, errors } = await uploadMedia(files);
    setItems((prev) => [...created, ...prev]);
    setMessage(errors.length ? errors.join(' ') : `${created.length} uploaded. Add a description to each so Google and screen readers understand it.`);
  }

  return (
    <>
      <label
        className={`${s.dropzone} ${over ? s.dropzoneActive : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); upload(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))); }}
      >
        <strong>Drop images here, or tap to choose</strong>
        <span className={s.help}>Upload many at once. Each is converted to WebP with phone, tablet and desktop sizes.</span>
        <input type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { upload(Array.from(e.target.files || [])); e.target.value = ''; }} />
      </label>
      {message && <p className={s.note} role="status">{message}</p>}
      <div className={s.toolbar}>
        <input type="search" placeholder="Search description or tag" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search images" />
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} aria-label="Show">
          <option value="all">All images ({items.length})</option>
          <option value="unused">Not on any category</option>
          <option value="noalt">Missing description</option>
        </select>
      </div>
      <div className={s.mediaGrid}>
        {shown.map((m) => (
          <button key={m.id} type="button" className={s.mediaCard} onClick={() => setOpen(m)}>
            <Thumb media={m} />
            <span className={m.alt ? '' : s.mediaWarn}>{m.alt || 'No description'}</span>
            <span>{onCategories(m.id) ? `On ${onCategories(m.id)} categor${onCategories(m.id) === 1 ? 'y' : 'ies'}` : 'Not on a category'}{m.tags?.length ? ` · ${m.tags.join(', ')}` : ''}</span>
          </button>
        ))}
      </div>
      {!shown.length && <p className={s.note}>No images match.</p>}
      {open && (
        <MediaDetail
          media={open}
          links={usage(open.id)}
          options={options}
          onClose={() => setOpen(null)}
          onSaved={(m, l) => { setItems(items.map((x) => x.id === m.id ? m : x)); setLinks([...links.filter((x) => x.media_id !== m.id), ...l]); setOpen(m); }}
          onDeleted={(id) => { setItems(items.filter((x) => x.id !== id)); setLinks(links.filter((x) => x.media_id !== id)); setOpen(null); setMessage('Image deleted.'); }}
        />
      )}
    </>
  );
}

export function MediaDetail({ media, links: initialLinks, options, onClose, onSaved, onDeleted }: {
  media: MediaRow; links: Link[]; options: Options; onClose: () => void;
  onSaved: (m: MediaRow, links: Link[]) => void; onDeleted: (id: number) => void;
}) {
  const [alt, setAlt] = useState(media.alt);
  const [tags, setTags] = useState<string[]>(media.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [links, setLinks] = useState<Link[]>(initialLinks);
  const [addType, setAddType] = useState<keyof Options>('site_category');
  const [addId, setAddId] = useState('');
  const [sizeShape, setSizeShape] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const replaceRef = useRef<HTMLInputElement>(null);

  const nameOf = (l: Link) => {
    const opt = options[l.target_type as keyof Options]?.find((o) => o.id === l.target_id);
    if (l.target_type === 'size' && opt) return `${options.shape.find((x) => x.id === opt.shape_id)?.name || ''} ${opt.name}`;
    return opt?.name || `#${l.target_id}`;
  };
  const addChoices = addType === 'size' ? options.size.filter((z) => String(z.shape_id) === sizeShape) : options[addType];

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  }

  async function save() {
    setBusy(true); setMessage('');
    const res = await fetch(`/api/admin/site/media/${media.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alt, tags, links: links.map(({ target_type, target_id }) => ({ target_type, target_id })) })
    });
    setBusy(false);
    if (!res.ok) { setMessage((await res.json().catch(() => ({}))).error || 'Could not save.'); return; }
    onSaved({ ...media, alt: alt.trim(), tags }, links);
    setMessage('Saved.');
  }

  async function replace(file: File | undefined) {
    if (!file) return;
    setBusy(true); setMessage('Replacing…');
    const out = await replaceMedia(media.id, file);
    setBusy(false);
    if (!out.media) { setMessage(out.error || 'Could not replace.'); return; }
    onSaved(out.media, links);
    setMessage('Image replaced everywhere it is used.');
  }

  async function remove() {
    const shown = links.filter((l) => l.target_type === 'site_category').length;
    const where = shown ? ` It is shown on ${shown} website categor${shown > 1 ? 'ies' : 'y'} and will disappear from ${shown > 1 ? 'them' : 'it'}.` : '';
    if (!confirm(`Delete this website image permanently?${where} The /po catalogue is not affected.`)) return;
    const res = await fetch(`/api/admin/site/media/${media.id}`, { method: 'DELETE' });
    if (!res.ok) { setMessage((await res.json().catch(() => ({}))).error || 'Could not delete.'); return; }
    onDeleted(media.id);
  }

  return (
    <div className={s.modalBackdrop} onClick={onClose}>
      <div className={s.modal} role="dialog" aria-modal="true" aria-label="Image details" onClick={(e) => e.stopPropagation()}>
        <div className={s.modalHead}>
          <h2>Image details</h2>
          <button type="button" className={s.iconBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className={s.detail} style={{ overflow: 'auto', paddingTop: 10 }}>
          <div>
            <img src={mediaSrc(media, 960)} alt={alt} />
            <p className={s.help}>{media.width}×{media.height}px · WebP · {Object.keys(media.variants || {}).length + 1} sizes</p>
            <div className={s.toolbar}>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => replaceRef.current?.click()}>Replace image</button>
              <button type="button" className="btn-danger" disabled={busy} onClick={remove}>Delete</button>
              <input ref={replaceRef} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => { replace(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          </div>
          <div>
            <div className={s.field}>
              <label htmlFor="alt">Description (alt text)</label>
              <p className={s.help}>Say what is in the photo, e.g. “5A white CZ round stones on black, 3mm”.</p>
              <textarea id="alt" rows={2} maxLength={200} value={alt} onChange={(e) => setAlt(e.target.value)} />
            </div>
            <div className={s.field}>
              <label htmlFor="tag">Tags</label>
              <div className={s.addRow}>
                <input id="tag" type="text" value={tagInput} placeholder="e.g. qc, china, hero" onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
                <button type="button" className="btn-ghost" onClick={addTag}>Add</button>
              </div>
              <div className={s.tagChips}>{tags.map((t) => <span key={t} className={s.tagChip}>{t}<button type="button" aria-label={`Remove tag ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}>✕</button></span>)}</div>
            </div>
            <div className={s.field}>
              <span className={s.label}>Categories and filter tags</span>
              <p className={s.help}>Tag the colour, shape, size and grade shown so the photo appears when visitors filter a category page.</p>
              {!links.length && <p className={s.help}>Not assigned yet.</p>}
              <div className={s.tagChips}>{links.map((l) => (
                <span key={`${l.target_type}-${l.target_id}`} className={s.tagChip}>{TYPE_LABEL[l.target_type as keyof Options]}: {nameOf(l)}
                  <button type="button" aria-label="Remove assignment" onClick={() => setLinks(links.filter((x) => x !== l))}>✕</button></span>
              ))}</div>
              <div className={s.addRow} style={{ marginTop: 8 }}>
                <select value={addType} onChange={(e) => { setAddType(e.target.value as keyof Options); setAddId(''); }} aria-label="Assign to">
                  {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {addType === 'size' && (
                  <select value={sizeShape} onChange={(e) => { setSizeShape(e.target.value); setAddId(''); }} aria-label="Shape">
                    <option value="">Shape…</option>
                    {options.shape.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                )}
                <select value={addId} onChange={(e) => setAddId(e.target.value)} aria-label="Which one">
                  <option value="">Choose…</option>
                  {addChoices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <button type="button" className="btn-ghost" disabled={!addId} onClick={() => {
                  const l = { media_id: media.id, target_type: addType, target_id: Number(addId) };
                  if (!links.some((x) => x.target_type === l.target_type && x.target_id === l.target_id)) setLinks([...links, l]);
                  setAddId('');
                }}>Assign</button>
              </div>
            </div>
          </div>
        </div>
        <div className={s.modalFoot}>
          {message && <span className={s.note} role="status" style={{ marginRight: 'auto' }}>{message}</span>}
          <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
          <button type="button" className="btn" disabled={busy} onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
