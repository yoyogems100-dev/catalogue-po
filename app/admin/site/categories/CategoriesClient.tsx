'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Sortable from '@/components/admin/site/Sortable';
import s from '@/components/admin/site/site-admin.module.css';

export type TreeRow = {
  id: number; parent_id: number | null; slug: string; name: string; sort_order: number;
  is_visible: boolean; published_at: string | null; updated_at: string; sources: number;
};

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong -- try again.');
  return data;
}

export default function CategoriesClient({ rows: initial }: { rows: TreeRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [toast, setToast] = useState('');
  const [newTop, setNewTop] = useState('');
  const [addingUnder, setAddingUnder] = useState<number | null>(null);
  const [newChild, setNewChild] = useState('');

  const top = rows.filter((r) => r.parent_id === null).sort((a, b) => a.sort_order - b.sort_order);
  const childrenOf = (id: number) => rows.filter((r) => r.parent_id === id).sort((a, b) => a.sort_order - b.sort_order);

  function flash(text: string) { setToast(text); setTimeout(() => setToast(''), 3000); }

  async function reorder(list: TreeRow[]) {
    const order = new Map(list.map((r, i) => [r.id, (i + 1) * 10]));
    const before = rows;
    setRows(rows.map((r) => order.has(r.id) ? { ...r, sort_order: order.get(r.id)! } : r));
    try { await send('/api/admin/site/categories', 'PUT', { ids: list.map((r) => r.id) }); flash('Order saved.'); }
    catch (e: any) { setRows(before); flash(e.message); }
  }

  async function toggleVisible(r: TreeRow) {
    setRows(rows.map((x) => x.id === r.id ? { ...x, is_visible: !r.is_visible } : x));
    try { await send(`/api/admin/site/categories/${r.id}`, 'PATCH', { is_visible: !r.is_visible }); flash(r.is_visible ? `${r.name} hidden from the website.` : `${r.name} is now shown on the website.`); }
    catch (e: any) { setRows(rows); flash(e.message); }
  }

  async function add(name: string, parent_id: number | null) {
    if (!name.trim()) return;
    try {
      const { id } = await send('/api/admin/site/categories', 'POST', { name, parent_id });
      router.push(`/admin/site/categories/${id}`);
    } catch (e: any) { flash(e.message); }
  }

  async function remove(r: TreeRow) {
    if (!confirm(`Delete the website page "${r.name}"? Its text and gallery links are removed. Catalogue categories and photos are not affected.`)) return;
    try { await send(`/api/admin/site/categories/${r.id}`, 'DELETE'); setRows(rows.filter((x) => x.id !== r.id)); flash(`${r.name} deleted.`); }
    catch (e: any) { flash(e.message); }
  }

  const status = (r: TreeRow) => (
    <>
      {!r.is_visible && <span className={`${s.pill} ${s.pillHidden}`}>Hidden</span>}
      {!r.published_at && <span className={`${s.pill} ${s.pillDraft}`}>Text not published</span>}
    </>
  );

  const rowView = (r: TreeRow, isChild: boolean) => (
    <div className={s.catRow}>
      <Link href={`/admin/site/categories/${r.id}`}>{r.name}</Link>
      {status(r)}
      <span className={s.catRowMeta}>{r.sources ? `${r.sources} catalogue link${r.sources > 1 ? 's' : ''}` : isChild || !childrenOf(r.id).length ? 'No catalogue link' : ''}</span>
      <span className={s.catRowActions}>
        <label className={s.toggle} title="Show on website"><input type="checkbox" checked={r.is_visible} onChange={() => toggleVisible(r)} aria-label={`Show ${r.name} on the website`} /> Shown</label>
        {(isChild || !childrenOf(r.id).length) && <button type="button" className={s.linkBtn} onClick={() => remove(r)}>Delete</button>}
      </span>
    </div>
  );

  return (
    <>
      <div className={s.crumbs}><Link href="/admin/site">Website</Link> / Categories</div>
      <div className={s.pageHead}>
        <div>
          <h1>Website categories</h1>
          <p className={s.note}>Drag the grip (or use the arrows) to change the order shown in the menu and on the home page. Open a category to edit its page, gallery and filters.</p>
        </div>
      </div>
      <Sortable
        items={top}
        getId={(r) => r.id}
        label={(r) => r.name}
        onReorder={reorder}
        render={(r) => (
          <div>
            {rowView(r, false)}
            <div className={s.children}>
              <Sortable items={childrenOf(r.id)} getId={(c) => c.id} label={(c) => c.name} onReorder={reorder} render={(c) => rowView(c, true)} />
              {addingUnder === r.id ? (
                <form className={s.addRow} onSubmit={(e) => { e.preventDefault(); add(newChild, r.id); }}>
                  <input autoFocus type="text" placeholder="Sub-category name" value={newChild} onChange={(e) => setNewChild(e.target.value)} />
                  <button className="btn" type="submit">Add</button>
                  <button className="btn-ghost" type="button" onClick={() => { setAddingUnder(null); setNewChild(''); }}>Cancel</button>
                </form>
              ) : (
                <button type="button" className="btn-ghost" onClick={() => { setAddingUnder(r.id); setNewChild(''); }}>+ Sub-category</button>
              )}
            </div>
          </div>
        )}
      />
      <form className={s.addRow} onSubmit={(e) => { e.preventDefault(); add(newTop, null); }}>
        <input type="text" placeholder="New top-level category" value={newTop} onChange={(e) => setNewTop(e.target.value)} />
        <button className="btn" type="submit">Add category</button>
      </form>
      <p className={s.note}>New categories start hidden, so you can fill in the page before visitors see it.</p>
      {toast && <p className="po-toast" role="status" aria-live="polite">{toast}</p>}
    </>
  );
}
