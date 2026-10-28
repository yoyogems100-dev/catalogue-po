'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Everyday catalogue jobs done straight from the Overview, so none of them
// needs its own page in the side pane: upload photos into any category (or
// leave them unassigned), add a category, put a tag or specification on a
// category, and add a shape or colour. Each form uses the same API routes as
// the full pages, and links on to the page where the rest is finished.

type Category = { id: number; name: string };
type Tag = { id: number; name: string };
type Result = { ok: boolean; text: string; href?: string; hrefLabel?: string } | null;

const post = (url: string, body: object) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

async function errorOf(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return (data && typeof data.error === 'string' && data.error) || fallback;
}

function Note({ result }: { result: Result }) {
  if (!result) return null;
  return (
    <p className={`quick-note ${result.ok ? 'ok' : 'err'}`} role={result.ok ? 'status' : 'alert'}>
      {result.text}{result.href && <> <Link href={result.href}>{result.hrefLabel} →</Link></>}
    </p>
  );
}

function CategorySelect({ categories, value, onChange, allowNone, id }: {
  categories: Category[]; value: string; onChange: (v: string) => void; allowNone?: boolean; id: string;
}) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required={!allowNone}>
      <option value="">{allowNone ? 'Decide later (Unassigned)' : 'Choose a category'}</option>
      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
}

function UploadPhotos({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [categoryId, setCategoryId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<Result>(null);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length || progress) return;
    setResult(null);
    let done = 0;
    const failed: string[] = [];
    for (const file of files) {
      setProgress(`Uploading ${done + failed.length + 1} of ${files.length}…`);
      const fd = new FormData();
      fd.append('file', file);
      if (categoryId) fd.append('category_id', categoryId);
      const res = await fetch('/api/photos/upload', { method: 'POST', body: fd }).catch(() => null);
      if (res?.ok) done++; else failed.push(file.name);
    }
    setProgress('');
    setFiles([]);
    if (fileRef.current) fileRef.current.value = '';
    const where = categoryId ? categories.find((c) => String(c.id) === categoryId)?.name : null;
    setResult({
      ok: failed.length === 0,
      text: `${done} photo${done === 1 ? '' : 's'} uploaded${where ? ` to ${where}` : ' to Unassigned'}.${failed.length ? ` Not uploaded: ${failed.join(', ')}.` : ''}`,
      href: categoryId ? `/admin/categories/${categoryId}?tab=photos` : '/admin/photos',
      hrefLabel: 'Tag shapes, sizes & colours'
    });
    router.refresh();
  }

  return (
    <form className="quick-card" id="quick-upload" onSubmit={upload}>
      <h3>Upload photos</h3>
      <label htmlFor="qa-photo-cat">Category</label>
      <CategorySelect id="qa-photo-cat" categories={categories} value={categoryId} onChange={setCategoryId} allowNone />
      <label htmlFor="qa-photo-files">Photos</label>
      <input id="qa-photo-files" ref={fileRef} type="file" accept="image/*" multiple
        onChange={(e) => { setFiles(Array.from(e.target.files || [])); setResult(null); }} />
      <button className="btn" type="submit" disabled={!files.length || !!progress}>
        {progress || (files.length ? `Upload ${files.length} photo${files.length === 1 ? '' : 's'}` : 'Upload')}
      </button>
      <Note result={result} />
    </form>
  );
}

function AddCategory() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true); setResult(null);
    const res = await post('/api/categories', { name: name.trim() });
    setBusy(false);
    if (!res.ok) { setResult({ ok: false, text: await errorOf(res, 'Could not add the category.') }); return; }
    const created = await res.json();
    setName('');
    setResult({ ok: true, text: `“${created.name}” added at the end of the list.`, href: `/admin/categories/${created.id}`, hrefLabel: 'Set it up' });
    router.refresh();
  }

  return (
    <form className="quick-card" onSubmit={add}>
      <h3>Add a category</h3>
      <label htmlFor="qa-cat-name">Name</label>
      <input id="qa-cat-name" type="text" value={name} maxLength={80} placeholder="e.g. Emerald Synthetic" onChange={(e) => setName(e.target.value)} />
      <button className="btn" type="submit" disabled={!name.trim() || busy}>{busy ? 'Adding…' : 'Add category'}</button>
      <Note result={result} />
    </form>
  );
}

function AddTag({ categories, tags }: { categories: Category[]; tags: Tag[] }) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const word = name.trim();
    if (!word || !categoryId || busy) return;
    setBusy(true); setResult(null);
    // Same rule as the tag row on each category: an existing tag name is
    // reused, never duplicated.
    const existing = tags.find((t) => t.name.toLowerCase() === word.toLowerCase());
    const res = existing
      ? await post('/api/category-links/tag', { category_id: Number(categoryId), tag_id: existing.id })
      : await post('/api/tags', { name: word, is_global: false, category_id: Number(categoryId) });
    setBusy(false);
    const category = categories.find((c) => String(c.id) === categoryId)?.name;
    if (!res.ok) { setResult({ ok: false, text: existing ? `“${existing.name}” may already be on ${category}.` : await errorOf(res, 'Could not save the tag.') }); return; }
    setName('');
    setResult({ ok: true, text: `“${existing?.name || word}” added to ${category}.`, href: `/admin/categories/${categoryId}`, hrefLabel: 'See its tags' });
    router.refresh();
  }

  return (
    <form className="quick-card" onSubmit={add}>
      <h3>Add a tag or specification</h3>
      <label htmlFor="qa-tag-cat">Category</label>
      <CategorySelect id="qa-tag-cat" categories={categories} value={categoryId} onChange={setCategoryId} />
      <label htmlFor="qa-tag-name">Tag</label>
      <input id="qa-tag-name" type="text" list="qa-tag-names" value={name} maxLength={60} placeholder="e.g. Heat resistant, AAA" onChange={(e) => setName(e.target.value)} />
      <datalist id="qa-tag-names">{tags.map((t) => <option key={t.id} value={t.name} />)}</datalist>
      <button className="btn" type="submit" disabled={!name.trim() || !categoryId || busy}>{busy ? 'Saving…' : 'Add tag'}</button>
      <Note result={result} />
    </form>
  );
}

function AddShapeOrColour() {
  const router = useRouter();
  const [kind, setKind] = useState<'shape' | 'colour'>('shape');
  const [name, setName] = useState('');
  const [hex, setHex] = useState('#B0AFAC');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true); setResult(null);
    const res = kind === 'shape'
      ? await post('/api/shapes', { name: name.trim() })
      : await post('/api/colors', { name: name.trim(), hex_value: hex });
    setBusy(false);
    if (!res.ok) { setResult({ ok: false, text: await errorOf(res, `Could not add the ${kind}.`) }); return; }
    const created = await res.json();
    setName('');
    setResult({
      ok: true,
      text: `${kind === 'shape' ? 'Shape' : 'Colour'} “${created.name}” added.`,
      href: kind === 'shape' ? '/admin/shapes' : '/admin/colors',
      hrefLabel: kind === 'shape' ? 'Add its sizes & photo' : 'Add its photo'
    });
    router.refresh();
  }

  return (
    <form className="quick-card" onSubmit={add}>
      <h3>Add a shape or colour</h3>
      <div className="cat-view-toggle quick-kind" role="group" aria-label="What to add">
        <button type="button" aria-pressed={kind === 'shape'} className={kind === 'shape' ? 'active' : ''} onClick={() => { setKind('shape'); setResult(null); }}>Shape</button>
        <button type="button" aria-pressed={kind === 'colour'} className={kind === 'colour' ? 'active' : ''} onClick={() => { setKind('colour'); setResult(null); }}>Colour</button>
      </div>
      <label htmlFor="qa-sc-name">Name</label>
      <div className="quick-row">
        <input id="qa-sc-name" type="text" value={name} maxLength={60} placeholder={kind === 'shape' ? 'e.g. Trillion' : 'e.g. Olive Green'} onChange={(e) => setName(e.target.value)} />
        {kind === 'colour' && <input type="color" aria-label="Swatch colour" value={hex} onChange={(e) => setHex(e.target.value)} />}
      </div>
      <p className="quick-hint">Link it to categories afterwards from the category or <Link href="/admin/bulk-link">Bulk link</Link>.</p>
      <button className="btn" type="submit" disabled={!name.trim() || busy}>{busy ? 'Adding…' : `Add ${kind}`}</button>
      <Note result={result} />
    </form>
  );
}

export default function DashboardQuickActions({ categories, tags }: { categories: Category[]; tags: Tag[] }) {
  return (
    <section className="quick-actions" aria-labelledby="quick-actions-heading">
      <h2 id="quick-actions-heading">Catalogue quick actions</h2>
      <div className="quick-grid">
        <UploadPhotos categories={categories} />
        <AddTag categories={categories} tags={tags} />
        <AddCategory />
        <AddShapeOrColour />
      </div>
    </section>
  );
}
