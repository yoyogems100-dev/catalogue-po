'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDragReorder, moveItem } from '@/hooks/useDragReorder';

type Row = {
  id: number;
  num: number;
  name: string;
  coverUrl: string | null;
  photoCount: number;
  shapeCount: number;
  sizeCount: number;
  colorCount: number;
};

export default function CategoriesClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');

  const [localRows, setLocalRows] = useState(rows);
  useEffect(() => setLocalRows(rows), [rows]);

  const visibleRows = search.trim()
    ? localRows.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()))
    : localRows;

  const { dragHandleProps, dropTargetProps, dragIndex, overIndex } = useDragReorder(async (from, to) => {
    const prev = localRows;
    const next = moveItem(localRows, from, to);
    setLocalRows(next);
    const res = await fetch('/api/categories/reorder-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: next.map((r) => r.id) })
    });
    if (!res.ok) {
      setLocalRows(prev);
      alert('Failed to save the new order.');
      return;
    }
    router.refresh();
  });

  async function addCategory() {
    if (!newName.trim()) return;
    setAdding(true);
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName })
    });
    setAdding(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to add category.');
      return;
    }
    setNewName('');
    router.refresh();
  }

  async function renameCategory(id: number, name: string) {
    const res = await fetch('/api/categories', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to rename category');
    }
    router.refresh();
  }

  async function deleteCategory(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This also deletes all its photos and shape/color/size links. Past orders keep their line items. This cannot be undone.`)) return;
    const res = await fetch('/api/categories', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to delete category');
    }
    router.refresh();
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, maxWidth: 420 }}>
        <input
          type="text"
          placeholder="New category name (e.g. Emerald Synthetic)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCategory()}
        />
        <button className="btn" onClick={addCategory} disabled={adding}>{adding ? 'Adding...' : 'Add category'}</button>
      </div>
      <div style={{ marginBottom: 12, maxWidth: 280 }}>
        <input type="text" placeholder="Search categories..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <p style={{ fontSize: 12, color: '#8a8370', marginBottom: 12 }}>
        Drag the &#9776; handle to reorder -- sets both the display order and the "#" number below. Click a category
        name to rename it.
      </p>

      <table>
        <thead>
          <tr><th></th><th>#</th><th>Cover</th><th>Category</th><th>Photos</th><th>Shapes</th><th>Sizes</th><th>Colors</th><th></th></tr>
        </thead>
        <tbody>
          {visibleRows.map((c) => {
            const index = localRows.findIndex((r) => r.id === c.id);
            const dragProps = search.trim() ? {} : dropTargetProps(index);
            return (
              <tr
                key={c.id}
                {...dragProps}
                className={!search.trim() && overIndex === index ? 'drag-over-row' : ''}
                style={{ opacity: !search.trim() && dragIndex === index ? 0.4 : 1 }}
              >
                <td style={{ width: 1 }}>
                  {!search.trim() && (
                    <span {...dragHandleProps(index)} className="drag-handle" title="Drag to reorder">&#9776;</span>
                  )}
                </td>
                <td>{String(c.num).padStart(2, '0')}</td>
                <td>
                  <div className="admin-cover-thumb">
                    {c.coverUrl ? <img src={c.coverUrl} alt="" /> : <span>No photo</span>}
                  </div>
                </td>
                <td><NameCell value={c.name} onSave={(name) => renameCategory(c.id, name)} /></td>
                <td>{c.photoCount}</td>
                <td>{c.shapeCount}</td>
                <td>{c.sizeCount}</td>
                <td>{c.colorCount}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <Link href={`/admin/categories/${c.id}`} className="btn-ghost" style={{ display: 'inline-block' }}>Manage &rarr;</Link>{' '}
                  <button className="btn-danger" onClick={() => deleteCategory(c.id, c.name)}>Delete</button>
                </td>
              </tr>
            );
          })}
          {visibleRows.length === 0 && (
            <tr><td colSpan={9} style={{ textAlign: 'center', color: '#8a8370', fontSize: 13 }}>No categories match "{search}".</td></tr>
          )}
        </tbody>
      </table>
    </>
  );
}

function NameCell({ value, onSave }: { value: string; onSave: (name: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  async function save() {
    const trimmed = text.trim();
    if (!trimmed || trimmed === value) {
      setText(value);
      setEditing(false);
      return;
    }
    setEditing(false);
    await onSave(trimmed);
  }

  if (!editing) {
    return (
      <span
        onClick={() => { setText(value); setEditing(true); }}
        style={{ cursor: 'pointer', borderBottom: '1px dashed var(--line)' }}
        title="Click to rename"
      >
        {value}
      </span>
    );
  }

  return (
    <input
      autoFocus
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') { setText(value); setEditing(false); }
      }}
      style={{ fontSize: 13, padding: '3px 6px', maxWidth: 180 }}
    />
  );
}
