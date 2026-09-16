'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Supplier = { id: number; name: string; company?: string | null; address?: string | null; contact_name?: string | null; phone?: string | null; email?: string | null; notes?: string | null };
type Category = { id: number; name: string };
type Rate = { id: number; categoryId: number; categoryName: string; shapeName: string; sizeMm: string; colorName: string; costPrice: number; notes: string | null };
type Options = { shapes: { id: number; name: string }[]; sizes: { id: number; shapeId: number; sizeMm: string }[]; colors: { id: number; name: string }[] };

export default function SupplierManager({ supplier, categories, linkedCategoryIds, rates }: { supplier: Supplier; categories: Category[]; linkedCategoryIds: number[]; rates: Rate[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: supplier.name, company: supplier.company || '', address: supplier.address || '', contactName: supplier.contact_name || '', phone: supplier.phone || '', email: supplier.email || '', notes: supplier.notes || '' });
  const [categoryIds, setCategoryIds] = useState(linkedCategoryIds);
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>(''); const [options, setOptions] = useState<Options | null>(null);
  const [shapeId, setShapeId] = useState<number | ''>(''); const [sizeId, setSizeId] = useState<number | ''>(''); const [colorId, setColorId] = useState<number | ''>('');
  const [costPrice, setCostPrice] = useState(''); const [rateNotes, setRateNotes] = useState('');
  useEffect(() => { if (!categoryId) { setOptions(null); return; } fetch(`/api/admin/categories/${categoryId}/options`).then((response) => response.json()).then(setOptions).catch(() => setOptions(null)); setShapeId(''); setSizeId(''); setColorId(''); }, [categoryId]);
  async function saveSupplier() {
    setSaving(true); setMessage('');
    const response = await fetch(`/api/admin/suppliers/${supplier.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, categoryIds }) });
    const data = await response.json().catch(() => ({})); setSaving(false);
    if (!response.ok) return setMessage(data.error || 'Could not save supplier.');
    setMessage('Supplier saved.'); router.refresh();
  }
  async function addRate() {
    if (!categoryId || !costPrice) return setMessage('Choose a category and enter the cost price.');
    setSaving(true); setMessage('');
    const response = await fetch(`/api/admin/suppliers/${supplier.id}/rates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categoryId, shapeId: shapeId || null, sizeId: sizeId || null, colorId: colorId || null, costPrice, notes: rateNotes }) });
    const data = await response.json().catch(() => ({})); setSaving(false);
    if (!response.ok) return setMessage(data.error || 'Could not add rate.');
    setCostPrice(''); setRateNotes(''); setMessage('Rate added.'); router.refresh();
  }
  async function removeRate(id: number) { await fetch(`/api/admin/suppliers/${supplier.id}/rates?id=${id}`, { method: 'DELETE' }); router.refresh(); }
  const sizes = options?.sizes.filter((size) => !shapeId || size.shapeId === shapeId) || [];

  const ratesByCategory = new Map<number, Rate[]>();
  rates.forEach((rate) => {
    const list = ratesByCategory.get(rate.categoryId) || [];
    list.push(rate);
    ratesByCategory.set(rate.categoryId, list);
  });
  const categoriesWithRates = categories.filter((category) => ratesByCategory.has(category.id));

  return <>
    <section className="card admin-profile-editor"><h2>Supplier details</h2><div className="admin-profile-grid">
      <label>Supplier name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label>Company<input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} /></label>
      <label>Contact person<input value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} /></label>
      <label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
      <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label>Address<input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
      <label className="admin-profile-wide">Notes<textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
    </div><h3>Categories supplied</h3><div className="admin-check-grid">{categories.map((category) => <label key={category.id}><input type="checkbox" checked={categoryIds.includes(category.id)} onChange={() => setCategoryIds((current) => current.includes(category.id) ? current.filter((id) => id !== category.id) : [...current, category.id])} />{category.name}</label>)}</div><div className="admin-form-actions"><button className="btn" onClick={saveSupplier} disabled={saving}>{saving ? 'Saving…' : 'Save supplier'}</button>{message && <span role="status">{message}</span>}</div></section>
    <section className="admin-linked-records"><div className="admin-section-head"><div><h2>Supplier rates</h2><p>Add a general category rate or narrow it to a shape, size and color.</p></div></div>
      <div className="card supplier-rate-form"><select value={categoryId} onChange={(event) => setCategoryId(event.target.value ? Number(event.target.value) : '')}><option value="">Category</option>{categories.filter((category) => categoryIds.includes(category.id)).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select><select value={shapeId} onChange={(event) => { setShapeId(event.target.value ? Number(event.target.value) : ''); setSizeId(''); }} disabled={!options}><option value="">All shapes</option>{options?.shapes.map((shape) => <option value={shape.id} key={shape.id}>{shape.name}</option>)}</select><select value={sizeId} onChange={(event) => setSizeId(event.target.value ? Number(event.target.value) : '')} disabled={!options}><option value="">All sizes</option>{sizes.map((size) => <option value={size.id} key={size.id}>{size.sizeMm} mm</option>)}</select><select value={colorId} onChange={(event) => setColorId(event.target.value ? Number(event.target.value) : '')} disabled={!options}><option value="">All colors</option>{options?.colors.map((color) => <option value={color.id} key={color.id}>{color.name}</option>)}</select><input inputMode="decimal" placeholder="CP (₹)" value={costPrice} onChange={(event) => setCostPrice(event.target.value.replace(/[^\d.]/g, ''))} /><input placeholder="Rate note" value={rateNotes} onChange={(event) => setRateNotes(event.target.value)} /><button className="btn" onClick={addRate} disabled={saving}>Add rate</button></div>
      {categoriesWithRates.map((category) => (
        <div key={category.id} style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 14, color: 'var(--gold)', marginBottom: 8 }}>{category.name}</h3>
          <div className="admin-directory-table-wrap"><table><thead><tr><th>Shape</th><th>Size</th><th>Color</th><th>CP</th><th>Note</th><th></th></tr></thead><tbody>
            {(ratesByCategory.get(category.id) || []).map((rate) => <tr key={rate.id}><td>{rate.shapeName}</td><td>{rate.sizeMm}</td><td>{rate.colorName}</td><td>₹{rate.costPrice}</td><td>{rate.notes || '—'}</td><td><button className="btn-danger" onClick={() => removeRate(rate.id)}>Remove</button></td></tr>)}
          </tbody></table></div>
        </div>
      ))}
      {!categoriesWithRates.length && <p style={{ marginTop: 16 }}>No rates recorded yet.</p>}
    </section>
  </>;
}
