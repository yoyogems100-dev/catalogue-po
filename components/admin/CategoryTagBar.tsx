'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HotMark } from '@/components/HotSelling';
import { confirmAction } from '@/components/admin/AdminDialogs';

type Tag = { id: number; name: string };

// The category's tags, editable in place on every tab of its workspace:
// + opens a box, type the word, Save. A name that already exists as a tag is
// linked rather than duplicated; × only unlinks it from this category, so
// other categories and tagged photos keep theirs. This replaced the separate
// Tags page.
export default function CategoryTagBar({ categoryId, tags, allTags }: { categoryId: number; tags: Tag[]; allTags: Tag[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const linkedIds = new Set(tags.map((t) => t.id));
  const suggestions = allTags.filter((t) => !linkedIds.has(t.id));

  function cancel() {
    setAdding(false);
    setName('');
    setError('');
  }

  async function save() {
    const word = name.trim();
    if (!word || busy) return;
    if (tags.some((t) => t.name.toLowerCase() === word.toLowerCase())) { setError(`“${word}” is already here.`); return; }
    setBusy(true);
    setError('');
    const existing = allTags.find((t) => t.name.toLowerCase() === word.toLowerCase());
    const res = existing
      ? await fetch('/api/category-links/tag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category_id: categoryId, tag_id: existing.id }) })
      : await fetch('/api/tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: word, is_global: false, category_id: categoryId }) });
    setBusy(false);
    if (!res.ok) { setError('Could not save the tag -- try again.'); return; }
    setName('');
    setAdding(false);
    router.refresh();
  }

  async function remove(tag: Tag) {
    if (!(await confirmAction(`Remove “${tag.name}” from this category? Other categories keep it.`))) return;
    const res = await fetch('/api/category-links/tag', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category_id: categoryId, tag_id: tag.id }) });
    if (!res.ok) { setError('Could not remove the tag -- try again.'); return; }
    router.refresh();
  }

  return (
    <section className="cat-tag-bar" aria-label="Tags">
      <span className="cat-tag-bar-label">Tags</span>
      {tags.map((t) => (
        <span key={t.id} className="tag-chip cat-tag-chip">
          <HotMark categoryId={categoryId} kind="tag" ids={[t.id]} name={t.name} />
          {t.name}
          <button type="button" className="cat-tag-x" aria-label={`Remove tag ${t.name}`} onClick={() => remove(t)}>&times;</button>
        </span>
      ))}
      {adding ? (
        <form className="cat-tag-add" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <input
            autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tag word"
            aria-label="New tag" list={`cat-tag-suggestions-${categoryId}`} maxLength={60}
            onKeyDown={(e) => { if (e.key === 'Escape') cancel(); }}
          />
          <datalist id={`cat-tag-suggestions-${categoryId}`}>
            {suggestions.map((t) => <option key={t.id} value={t.name} />)}
          </datalist>
          <button type="submit" className="btn" disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save'}</button>
          <button type="button" className="btn-ghost" onClick={cancel}>Cancel</button>
        </form>
      ) : (
        <button type="button" className="tag-chip cat-tag-plus" onClick={() => setAdding(true)} aria-label="Add a tag">+</button>
      )}
      {!tags.length && !adding && <span className="cat-tag-empty">No tags yet</span>}
      {error && <p className="cat-tag-error" role="alert">{error}</p>}
    </section>
  );
}
