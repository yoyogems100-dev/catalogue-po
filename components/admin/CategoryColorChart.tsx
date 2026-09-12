'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ColorChart from '@/components/ColorChart';

export default function CategoryColorChart({ categoryId, categoryName, initialUrl }: { categoryId: number; categoryName: string; initialUrl: string | null }) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function save(file?: File) {
    if (busy) return;
    if (file && file.size > 3 * 1024 * 1024) { setMessage('Choose an image smaller than 3 MB.'); return; }
    setBusy(true); setMessage('');
    const body = new FormData();
    if (file) body.set('file', file); else body.set('remove', 'true');
    try {
      const response = await fetch(`/api/admin/categories/${categoryId}/color-chart`, { method: 'POST', body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save chart.');
      setUrl(result.url); setMessage(file ? 'Color chart saved.' : 'Color chart removed from the website.'); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save chart. Please retry.'); }
    finally { setBusy(false); }
  }
  return <section className="admin-color-chart card">
    <h2>Color chart</h2>
    <p>This chart stays beside the product reference photos while customers prepare their requirement.</p>
    {url ? <ColorChart url={url} categoryName={categoryName} /> : <p className="po-empty">No color chart uploaded yet.</p>}
    <label className="chart-upload-label">{url ? 'Replace color chart' : 'Upload color chart'}
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void save(file); }} />
    </label>
    <p>JPG, PNG or WebP · up to 3 MB. Upload the complete chart; it will not be cropped. Customers can enlarge and zoom to read the names.</p>
    {url && <button className="btn-ghost" disabled={busy} onClick={() => { if (confirm('Remove this color chart from the website? You can upload it again later.')) void save(); }}>Remove chart</button>}
    <p role="status">{busy ? 'Saving chart…' : message}</p>
  </section>;
}
