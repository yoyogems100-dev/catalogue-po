'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DiscussionCard from '@/components/DiscussionCard';
import DiscussionPhotos from '@/components/DiscussionPhotos';
import { prepareForUpload } from '@/components/admin/site/MediaPicker';
import { confirmAction, notify } from '@/components/admin/AdminDialogs';
import { DISCUSSION_PHOTO_UPLOAD_LIMIT, OTHER_PLACE, PHOTOS_PER_ITEM_MAX, PLACE_MAX, type Discussion } from '@/lib/discussions';

type Category = { id: number; name: string };
type Row = { category_id: number | null; label: string; details: string; photos: string[] };
type Form = { heldOn: string; placePick: string; otherPlace: string; items: Row[]; notes: string };

const today = () => {
  // The team's calendar day in India, not the server's or UTC.
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return parts;
};
const blankRow = (): Row => ({ category_id: null, label: 'General', details: '', photos: [] });

function formFor(d: Discussion | null, places: string[]): Form {
  if (!d) return { heldOn: today(), placePick: places[0] || OTHER_PLACE, otherPlace: '', items: [blankRow()], notes: '' };
  const known = d.place && places.find((p) => p.toLowerCase() === d.place!.toLowerCase());
  return {
    heldOn: d.held_on.slice(0, 10),
    placePick: known || (d.place ? OTHER_PLACE : ''),
    otherPlace: known ? '' : d.place || '',
    items: d.items.length ? d.items.map((i) => ({ ...i, photos: [...(i.photos || [])] })) : [blankRow()],
    notes: d.notes || '',
  };
}

// Admin > Customers > one buyer > Discussions: notes from calls, meetings and
// exhibitions. The buyer sees the same cards (read-only) in My Account.
export default function CustomerDiscussions({ customerId, initialDiscussions, initialPlaces, categories, tableMissing }: {
  customerId: number; initialDiscussions: Discussion[]; initialPlaces: string[]; categories: Category[]; tableMissing: boolean;
}) {
  const router = useRouter();
  const [places, setPlaces] = useState(initialPlaces);
  const [editing, setEditing] = useState<'new' | number | null>(initialDiscussions.length ? null : 'new');
  const [form, setForm] = useState<Form>(() => formFor(null, initialPlaces));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [addingPlace, setAddingPlace] = useState(false);
  const [newPlace, setNewPlace] = useState('');
  const [uploading, setUploading] = useState<number | null>(null);

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const setRow = (i: number, patch: Partial<Row>) => setForm((f) => ({ ...f, items: f.items.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));

  function open(target: 'new' | Discussion) {
    setMessage('');
    if (target === 'new') { setForm(formFor(null, places)); setEditing('new'); }
    else { setForm(formFor(target, places)); setEditing(target.id); }
  }

  // Photos upload one at a time as they are picked; they join the item when
  // the discussion is saved.
  async function addPhotos(i: number, files: FileList | null) {
    const picked = Array.from(files || []);
    if (!picked.length) return;
    const room = PHOTOS_PER_ITEM_MAX - (form.items[i]?.photos.length || 0);
    if (room <= 0) return notify(`Up to ${PHOTOS_PER_ITEM_MAX} photos per item.`);
    setUploading(i); setMessage('');
    const errors: string[] = [];
    for (const file of picked.slice(0, room)) {
      const prepared = await prepareForUpload(file);
      if (prepared.size > DISCUSSION_PHOTO_UPLOAD_LIMIT + 400_000) { errors.push(`${file.name}: too large -- use a JPG under 4 MB.`); continue; }
      const body = new FormData();
      body.append('file', prepared);
      const res = await fetch(`/api/admin/customers/${customerId}/discussions/photos`, { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.path) { errors.push(data.error || `${file.name}: upload failed.`); continue; }
      setForm((f) => ({ ...f, items: f.items.map((r, j) => (j === i ? { ...r, photos: [...r.photos, data.path] } : r)) }));
    }
    if (picked.length > room) errors.push(`Only ${PHOTOS_PER_ITEM_MAX} photos per item -- ${picked.length - room} skipped.`);
    setUploading(null);
    if (errors.length) setMessage(errors.join(' '));
  }

  async function savePlaces(next: string[]) {
    const res = await fetch('/api/admin/discussion-places', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ places: next }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { notify(data.error || 'Could not save the place list.'); return null; }
    setPlaces(data.places);
    return data.places as string[];
  }

  async function addPlace() {
    const name = newPlace.replace(/\s+/g, ' ').trim();
    if (!name) return;
    const existing = places.find((p) => p.toLowerCase() === name.toLowerCase());
    if (existing) { set({ placePick: existing }); setAddingPlace(false); setNewPlace(''); return; }
    if (name.toLowerCase() === OTHER_PLACE.toLowerCase()) { set({ placePick: OTHER_PLACE }); setAddingPlace(false); setNewPlace(''); return; }
    setBusy(true);
    const saved = await savePlaces([...places, name]);
    setBusy(false);
    if (!saved) return;
    set({ placePick: saved.find((p) => p.toLowerCase() === name.toLowerCase()) || name, otherPlace: '' });
    setAddingPlace(false); setNewPlace('');
  }

  async function removePlace(name: string) {
    if (!(await confirmAction(`Remove "${name}" from the place list? Discussions already saved there keep it.`))) return;
    setBusy(true);
    const saved = await savePlaces(places.filter((p) => p !== name));
    setBusy(false);
    if (saved && form.placePick === name) set({ placePick: OTHER_PLACE, otherPlace: name });
  }

  async function save() {
    setBusy(true); setMessage('');
    const place = form.placePick === OTHER_PLACE ? form.otherPlace : form.placePick;
    const url = editing === 'new' ? `/api/admin/customers/${customerId}/discussions` : `/api/admin/customers/${customerId}/discussions/${editing}`;
    const res = await fetch(url, {
      method: editing === 'new' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ heldOn: form.heldOn, place, items: form.items, notes: form.notes }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMessage(data.error || 'Could not save the discussion.');
    setEditing(null);
    setMessage('Saved. The customer can see it under Discussions in their account.');
    router.refresh();
  }

  async function remove(d: Discussion) {
    if (!(await confirmAction('Delete this discussion? The customer will no longer see it. This cannot be undone.'))) return;
    const res = await fetch(`/api/admin/customers/${customerId}/discussions/${d.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return notify(data.error || 'Could not delete the discussion.');
    if (editing === d.id) setEditing(null);
    router.refresh();
  }

  if (tableMissing) {
    return <section className="card admin-profile-editor"><h2>Discussions</h2><p className="login-hint">Discussions need a one-time database update (migration 20261127090000_customer_discussions) before they can be saved.</p></section>;
  }

  const editor = (
    <section className="card admin-profile-editor discussion-editor" aria-labelledby="discussion-form-heading">
      <h2 id="discussion-form-heading">{editing === 'new' ? 'Add a discussion' : 'Edit discussion'}</h2>
      <div className="admin-profile-grid">
        <label>Date held
          <input type="date" value={form.heldOn} max={today()} onChange={(e) => set({ heldOn: e.target.value })} required />
        </label>
        <div className="discussion-place-field">
          <label htmlFor="discussion-place">Where</label>
          <div className="discussion-place-row">
            <select id="discussion-place" value={form.placePick} onChange={(e) => set({ placePick: e.target.value })}>
              {form.placePick === '' && <option value="">Not set</option>}
              {places.map((p) => <option key={p} value={p}>{p}</option>)}
              <option value={OTHER_PLACE}>Other (type it)</option>
            </select>
            <button type="button" className="btn-ghost discussion-icon-btn" aria-label="Add a place to the list" aria-expanded={addingPlace} title="Add a place" onClick={() => setAddingPlace((v) => !v)}>+</button>
          </div>
          {form.placePick === OTHER_PLACE && (
            <input type="text" value={form.otherPlace} maxLength={PLACE_MAX} placeholder="e.g. Customer's shop, Mumbai" onChange={(e) => set({ otherPlace: e.target.value })} aria-label="Other place" />
          )}
        </div>
      </div>
      {addingPlace && (
        <div className="discussion-places-manage">
          <div className="discussion-place-row">
            <input type="text" value={newPlace} maxLength={PLACE_MAX} placeholder="New place, e.g. Mumbai office" aria-label="New place"
              onChange={(e) => setNewPlace(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPlace(); } }} autoFocus />
            <button type="button" className="btn" onClick={addPlace} disabled={busy || !newPlace.trim()}>Add place</button>
          </div>
          <div className="discussion-place-chips" aria-label="Saved places">
            {places.map((p) => (
              <span key={p} className="tag-chip">{p}<button type="button" aria-label={`Remove ${p}`} onClick={() => removePlace(p)} disabled={busy}>×</button></span>
            ))}
          </div>
        </div>
      )}

      <h3 className="discussion-subhead">Items discussed</h3>
      <div className="discussion-rows">
        {form.items.map((row, i) => (
          <div key={i} className="discussion-row">
            <select aria-label={`Category for item ${i + 1}`} value={row.category_id ?? ''}
              onChange={(e) => {
                const id = Number(e.target.value) || null;
                setRow(i, { category_id: id, label: id ? categories.find((c) => c.id === id)?.name || row.label : 'General' });
              }}>
              <option value="">General</option>
              {/* Keep a category that was archived after this was written. */}
              {row.category_id && !categories.some((c) => c.id === row.category_id) && <option value={row.category_id}>{row.label}</option>}
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <textarea rows={2} aria-label={`What was discussed for item ${i + 1}`} value={row.details}
              placeholder="e.g. G White, Canary Yellow, Light Pink" onChange={(e) => setRow(i, { details: e.target.value })} />
            <button type="button" className="btn-ghost discussion-icon-btn" aria-label={`Remove item ${i + 1}`} title="Remove item"
              onClick={() => setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, j) => j !== i) : [blankRow()] }))}>×</button>
            <div className="discussion-row-photos">
              <DiscussionPhotos paths={row.photos} label={row.label} onRemove={(p) => setRow(i, { photos: row.photos.filter((x) => x !== p) })} />
              <label className={`btn-ghost discussion-photo-add${uploading !== null ? ' is-disabled' : ''}`}>
                {uploading === i ? 'Uploading…' : row.photos.length ? '+ More photos' : '+ Add photos'}
                <input type="file" accept="image/*" multiple hidden disabled={uploading !== null || busy}
                  onChange={(e) => { addPhotos(i, e.target.files); e.target.value = ''; }} />
              </label>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="btn-ghost" onClick={() => setForm((f) => ({ ...f, items: [...f.items, blankRow()] }))}>+ Add item</button>

      <label className="discussion-notes-field">Notes
        <textarea rows={3} value={form.notes} placeholder="Anything else agreed: samples, follow-up, timelines…" onChange={(e) => set({ notes: e.target.value })} />
      </label>
      <div className="admin-form-actions">
        <button type="button" className="btn" onClick={save} disabled={busy || uploading !== null}>{busy ? 'Saving…' : editing === 'new' ? 'Save discussion' : 'Save changes'}</button>
        {(initialDiscussions.length > 0 || editing !== 'new') && <button type="button" className="btn-ghost" onClick={() => { setEditing(null); setMessage(''); }} disabled={busy}>Cancel</button>}
      </div>
      {message && <p role="status" className="admin-inline-status">{message}</p>}
    </section>
  );

  return (
    <section className="admin-linked-records">
      <div className="admin-section-head">
        <div><h2>Recent discussions</h2><p>Calls, meetings and exhibitions with this customer. They see these in their account.</p></div>
        {editing === null && <button type="button" className="btn" onClick={() => open('new')}>+ Add discussion</button>}
      </div>
      {editing === 'new' && editor}
      {editing === null && message && <p role="status" className="admin-inline-status" style={{ marginBottom: 14 }}>{message}</p>}
      <div className="discussion-list">
        {initialDiscussions.map((d) => (
          editing === d.id ? <div key={d.id}>{editor}</div> : (
            <DiscussionCard key={d.id} discussion={d} actions={<>
              <button type="button" className="btn-ghost" onClick={() => open(d)} disabled={editing !== null}>Edit</button>
              <button type="button" className="btn-ghost" onClick={() => remove(d)}>Delete</button>
            </>} />
          )
        ))}
        {!initialDiscussions.length && editing === null && <p>No discussions saved for this customer yet.</p>}
      </div>
    </section>
  );
}
