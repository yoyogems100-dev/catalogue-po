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

  const [localRows, setLocalRows] = useState(rows);
  useEffect(() => setLocalRows(rows), [rows]);

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

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, maxWidth: 420 }}>
        <input
          type="text"
          placeholder="New category name (e.g. Emerald Synthetic)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCategory()}
        />
        <button className="btn" onClick={addCategory} disabled={adding}>{adding ? 'Adding...' : 'Add category'}</button>
      </div>
      <p style={{ fontSize: 12, color: '#8a8370', marginBottom: 12 }}>
        Drag the &#9776; handle to reorder -- sets both the display order and the "#" number below.
      </p>

      <table>
        <thead>
          <tr><th></th><th>#</th><th>Cover</th><th>Category</th><th>Photos</th><th>Shapes</th><th>Sizes</th><th>Colors</th><th></th></tr>
        </thead>
        <tbody>
          {localRows.map((c, index) => (
            <tr
              key={c.id}
              {...dropTargetProps(index)}
              className={overIndex === index ? 'drag-over-row' : ''}
              style={{ opacity: dragIndex === index ? 0.4 : 1 }}
            >
              <td style={{ width: 1 }}>
                <span {...dragHandleProps(index)} className="drag-handle" title="Drag to reorder">&#9776;</span>
              </td>
              <td>{String(c.num).padStart(2, '0')}</td>
              <td>
                <div className="admin-cover-thumb">
                  {c.coverUrl ? <img src={c.coverUrl} alt="" /> : <span>No photo</span>}
                </div>
              </td>
              <td>{c.name}</td>
              <td>{c.photoCount}</td>
              <td>{c.shapeCount}</td>
              <td>{c.sizeCount}</td>
              <td>{c.colorCount}</td>
              <td><Link href={`/admin/categories/${c.id}`} className="btn-ghost" style={{ display: 'inline-block' }}>Manage &rarr;</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
