'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MediaPicker, { Thumb } from '@/components/admin/site/MediaPicker';
import type { MediaRow } from '@/lib/site/media-url';
import s from '@/components/admin/site/site-admin.module.css';

type Category = { id: number; parent_id: number | null; slug: string; name: string; descriptor: string; is_visible: boolean; hero_media_id: number | null };

export default function DetailsForm({ category, parents, hasChildren, tileMedia, parentSlug }: {
  category: Category; parents: { id: number; name: string }[]; hasChildren: boolean; tileMedia: MediaRow | null; parentSlug: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(category.name);
  const [slug, setSlug] = useState(category.slug);
  const [descriptor, setDescriptor] = useState(category.descriptor);
  const [parentId, setParentId] = useState<number | null>(category.parent_id);
  const [visible, setVisible] = useState(category.is_visible);
  const [tile, setTile] = useState<MediaRow | null>(tileMedia);
  const [picking, setPicking] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const parentSlugNow = parentId === category.parent_id ? parentSlug : null;
  const url = parentId ? `/products/${parentSlugNow ?? '…'}/${slug}` : `/products/${slug}`;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (slug !== category.slug && !confirm('Changing the web address breaks links people already have (WhatsApp, Google). Continue?')) return;
    setSaving(true); setMessage('');
    const res = await fetch(`/api/admin/site/categories/${category.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug, descriptor, parent_id: parentId, is_visible: visible, hero_media_id: tile?.id ?? null })
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setMessage(body.error || 'Could not save.'); return; }
    if (body.slug) setSlug(body.slug);
    setMessage('Saved. These settings are live immediately.');
    router.refresh();
  }

  return (
    <form className={s.form} onSubmit={save}>
      <div className={s.field}>
        <label htmlFor="name">Name</label>
        <input id="name" type="text" value={name} maxLength={80} required onChange={(e) => setName(e.target.value)} />
      </div>
      <div className={s.field}>
        <label htmlFor="descriptor">Short description</label>
        <p className={s.help}>One line shown on the category tile and in the menu.</p>
        <input id="descriptor" type="text" value={descriptor} maxLength={120} onChange={(e) => setDescriptor(e.target.value)} />
      </div>
      <div className={s.field}>
        <label htmlFor="slug">Web address</label>
        <p className={s.help}>Lowercase words joined by dashes. Page address: <strong>{url}</strong></p>
        <input id="slug" type="text" value={slug} maxLength={60} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} />
      </div>
      <div className={s.field}>
        <label htmlFor="parent">Sits under</label>
        {hasChildren ? (
          <p className={s.help}>This category has sub-categories, so it stays at the top level.</p>
        ) : (
          <select id="parent" value={parentId ?? ''} onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">— Top level (its own menu column) —</option>
            {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>
      <div className={s.field}>
        <label className={s.toggle}><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} /> Show on the website</label>
      </div>
      <div className={s.field}>
        <span className={s.label}>Tile image</span>
        <p className={s.help}>Used on the home-page category grid and the menu. If empty, the page’s hero image is used.</p>
        <div className={s.imageField}>
          {tile ? <Thumb media={tile} size={96} /> : <div className={s.imageEmpty}>No image</div>}
          <div className={s.imageActions}>
            <button type="button" className="btn-ghost" onClick={() => setPicking(true)}>{tile ? 'Change' : 'Choose image'}</button>
            {tile && <button type="button" className="btn-ghost" onClick={() => setTile(null)}>Remove</button>}
          </div>
        </div>
        <MediaPicker open={picking} onClose={() => setPicking(false)} onPick={(rows) => setTile(rows[0] || null)} />
      </div>
      <div><button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save details'}</button></div>
      {message && <p className={s.note} role="status">{message}</p>}
    </form>
  );
}
