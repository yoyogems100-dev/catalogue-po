'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Watermark = { id: number; name: string; opacity: number; url: string | null; text: string | null; color: string | null };

const COLORS = [
  { value: '#ffffff', label: 'White' },
  { value: '#12233f', label: 'Deep ink' },
  { value: '#9c7a25', label: 'Gold' }
];

/** The watermark drawn on a real catalogue photo by the server, at exactly
    the settings on screen. Debounced so dragging the slider doesn't fire a
    request per pixel. */
function usePreviewUrl(text: string, color: string, opacity: number) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!text.trim()) { setUrl(null); return; }
    const t = setTimeout(() => {
      const q = new URLSearchParams({ text, color, opacity: String(opacity) });
      setUrl(`/api/admin/watermarks/preview?${q.toString()}`);
    }, 350);
    return () => clearTimeout(t);
  }, [text, color, opacity]);
  return url;
}

export default function WatermarksClient({ initialWatermarks }: { initialWatermarks: Watermark[] }) {
  const router = useRouter();
  const [watermarks, setWatermarks] = useState(initialWatermarks);
  const [text, setText] = useState('');
  const [color, setColor] = useState('#ffffff');
  const [opacity, setOpacity] = useState(0.45);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewUrl = usePreviewUrl(text, color, opacity);

  async function refresh() {
    const res = await fetch('/api/admin/watermarks');
    const data = await res.json().catch(() => ({}));
    if (data.watermarks) setWatermarks(data.watermarks);
    router.refresh();
  }

  async function addText() {
    if (!text.trim()) { setToast('Enter the watermark text.'); return; }
    setSaving(true);
    const res = await fetch('/api/admin/watermarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim(), color, opacity })
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setToast(d.error || 'Could not add this watermark.'); return; }
    setText('');
    setToast('Watermark added.');
    await refresh();
  }

  async function upload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !uploadName.trim()) { setToast('Enter a name and choose an image.'); return; }
    setSaving(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', uploadName.trim());
    formData.append('opacity', String(opacity));
    const res = await fetch('/api/admin/watermarks', { method: 'POST', body: formData });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setToast(d.error || 'Could not add this watermark.'); return; }
    setUploadName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setToast('Watermark added.');
    await refresh();
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
      <section className="card watermark-editor">
        <div className="watermark-editor-fields">
          <h3>Add a watermark</h3>
          <label>
            Text
            <input type="text" placeholder="YOYO GEMS" value={text} onChange={(e) => setText(e.target.value)} maxLength={60} />
          </label>
          <label>
            Colour
            <span className="watermark-swatches">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={color === c.value ? 'watermark-swatch is-on' : 'watermark-swatch'}
                  style={{ background: c.value }}
                  aria-label={c.label}
                  aria-pressed={color === c.value}
                  onClick={() => setColor(c.value)}
                />
              ))}
            </span>
          </label>
          <label>
            Transparency: {Math.round(opacity * 100)}%
            <input type="range" min={5} max={100} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(Number(e.target.value) / 100)} />
          </label>
          <button className="btn" onClick={addText} disabled={saving || !text.trim()}>{saving ? 'Adding…' : 'Add watermark'}</button>

          <button type="button" className="watermark-upload-toggle" onClick={() => setShowUpload((v) => !v)}>
            {showUpload ? 'Hide image upload' : 'Upload an image instead'}
          </button>
          {showUpload && (
            <div className="watermark-upload">
              <input type="text" placeholder="Name, e.g. logo mark" value={uploadName} onChange={(e) => setUploadName(e.target.value)} />
              <input ref={fileInputRef} type="file" accept="image/png,image/webp" />
              <button className="btn-ghost" onClick={upload} disabled={saving}>Add image watermark</button>
            </div>
          )}
          {toast && <p role="status" className="watermark-toast">{toast}</p>}
        </div>

        <div className="watermark-preview">
          <span className="watermark-preview-label">Preview on a real photo</span>
          {previewUrl
            ? <img src={previewUrl} alt="The watermark drawn on a sample photo" />
            : <p className="watermark-preview-empty">Type the text to see it on a photo.</p>}
        </div>
      </section>

      <div className="watermark-grid">
        {watermarks.map((w) => (
          <div key={w.id} className="card watermark-card">
            <div className="watermark-card-art" style={w.text ? { background: '#5d5445' } : undefined}>
              {w.text
                ? <span style={{ color: w.color || '#fff', opacity: w.opacity }}>{w.text}</span>
                : w.url && <img src={w.url} alt={w.name} />}
            </div>
            <strong>{w.name}</strong>
            <label>
              Transparency: {Math.round(w.opacity * 100)}%
              <input type="range" min={5} max={100} value={Math.round(w.opacity * 100)} onChange={(e) => updateOpacity(w.id, Number(e.target.value) / 100)} />
            </label>
            <button className="btn-danger" onClick={() => remove(w.id, w.name)}>Delete</button>
          </div>
        ))}
        {watermarks.length === 0 && <p className="watermark-preview-empty">No watermarks yet — add one above.</p>}
      </div>
    </>
  );
}
