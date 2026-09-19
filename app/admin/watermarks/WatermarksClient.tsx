'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Watermark = { id: number; name: string; opacity: number; url: string };

export default function WatermarksClient({ initialWatermarks }: { initialWatermarks: Watermark[] }) {
  const router = useRouter();
  const [watermarks, setWatermarks] = useState(initialWatermarks);
  const [name, setName] = useState('');
  const [opacity, setOpacity] = useState(0.5);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function upload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !name.trim()) { setToast('Enter a name and choose an image.'); return; }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name.trim());
    formData.append('opacity', String(opacity));
    const res = await fetch('/api/admin/watermarks', { method: 'POST', body: formData });
    setUploading(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setToast(d.error || 'Could not add this watermark.'); return; }
    setName(''); setOpacity(0.5);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setToast('Watermark added.');
    router.refresh();
    const listRes = await fetch('/api/admin/watermarks');
    const data = await listRes.json().catch(() => ({}));
    if (data.watermarks) setWatermarks(data.watermarks);
  }

  async function updateOpacity(id: number, next: number) {
    setWatermarks((cur) => cur.map((w) => (w.id === id ? { ...w, opacity: next } : w)));
    await fetch(`/api/admin/watermarks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ opacity: next }) });
  }

  async function remove(id: number, wmName: string) {
    if (!confirm(`Delete "${wmName}"? Photos that already used it keep looking the same, but you won't be able to pick it again.`)) return;
    const res = await fetch(`/api/admin/watermarks/${id}`, { method: 'DELETE' });
    if (!res.ok) { setToast('Could not delete this watermark.'); return; }
    setWatermarks((cur) => cur.filter((w) => w.id !== id));
    setToast('Watermark deleted.');
    router.refresh();
  }

  return (
    <>
      <section className="card" style={{ padding: 16, maxWidth: 480, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ fontSize: 14, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Add a watermark</h3>
        <input type="text" placeholder="Name, e.g. wm1" value={name} onChange={(e) => setName(e.target.value)} />
        <input ref={fileInputRef} type="file" accept="image/png,image/webp" />
        <label style={{ fontSize: 12.5 }}>
          Transparency: {Math.round(opacity * 100)}%
          <input type="range" min={5} max={100} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(Number(e.target.value) / 100)} style={{ display: 'block', width: '100%' }} />
        </label>
        <button className="btn" onClick={upload} disabled={uploading}>{uploading ? 'Adding…' : 'Add watermark'}</button>
        {toast && <p role="status" style={{ fontSize: 12.5, color: '#756e5c' }}>{toast}</p>}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {watermarks.map((w) => (
          <div key={w.id} className="card" style={{ padding: 14 }}>
            <div style={{ aspectRatio: '1/1', background: '#eee', borderRadius: 6, overflow: 'hidden', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={w.url} alt={w.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
            <strong>{w.name}</strong>
            <label style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
              Transparency: {Math.round(w.opacity * 100)}%
              <input type="range" min={5} max={100} value={Math.round(w.opacity * 100)} onChange={(e) => updateOpacity(w.id, Number(e.target.value) / 100)} style={{ display: 'block', width: '100%' }} />
            </label>
            <button className="btn-danger" style={{ marginTop: 8, width: '100%' }} onClick={() => remove(w.id, w.name)}>Delete</button>
          </div>
        ))}
        {watermarks.length === 0 && <p style={{ fontSize: 13, color: '#756e5c' }}>No watermarks yet -- add one above.</p>}
      </div>
    </>
  );
}
