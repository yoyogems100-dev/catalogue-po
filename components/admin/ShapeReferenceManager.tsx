'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ShapeIcon from '@/components/ShapeIcon';
import ShapeReferenceImage from '@/components/ShapeReferenceImage';
import { HotMark } from '@/components/HotSelling';

type ReferenceStyle = 'vector' | 'photo';
type ShapeReference = {
  shapeId: number;
  name: string;
  iconKey?: string | null;
  refPhotoUrl?: string | null;
  referenceStyle: ReferenceStyle;
};

export default function ShapeReferenceManager({ categoryId, references }: { categoryId: number; references: ShapeReference[] }) {
  const router = useRouter();
  const [local, setLocal] = useState(references);
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => setLocal(references), [references]);

  async function setStyle(shapeId: number, referenceStyle: ReferenceStyle) {
    const previous = local;
    setLocal((items) => items.map((item) => item.shapeId === shapeId ? { ...item, referenceStyle } : item));
    setBusy(shapeId);
    const response = await fetch('/api/category-links/shape', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId, shape_id: shapeId, reference_style: referenceStyle }),
    });
    setBusy(null);
    if (!response.ok) {
      setLocal(previous);
      setMessage('Could not save the reference choice.');
      return;
    }
    setMessage(referenceStyle === 'photo' ? 'Gemstone photo selected.' : 'Vector reference selected.');
    router.refresh();
  }

  async function uploadPhoto(shapeId: number, file?: File) {
    if (!file) return;
    setBusy(shapeId);
    const body = new FormData();
    body.append('shape_id', String(shapeId));
    body.append('file', file);
    const response = await fetch(`/api/admin/categories/${categoryId}/shape-reference`, { method: 'POST', body });
    const data = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setMessage(data.error || 'Could not upload this shape photo.');
      return;
    }
    setLocal((items) => items.map((item) => item.shapeId === shapeId ? { ...item, refPhotoUrl: data.refPhotoUrl, referenceStyle: 'photo' } : item));
    setMessage('Gemstone photo uploaded and selected.');
    router.refresh();
  }

  return (
    <section className="shape-reference-manager" aria-labelledby="shape-reference-title">
      <div className="shape-reference-manager-head">
        <div>
          <h3 id="shape-reference-title">Shapes in this category</h3>
        </div>
      </div>
      <div className="shape-reference-admin-grid">
        {local.map((shape) => {
          const canUsePhoto = !!shape.refPhotoUrl;
          const effectiveStyle = shape.referenceStyle === 'photo' && canUsePhoto ? 'photo' : 'vector';
          return (
            <article className="shape-reference-admin-row" key={shape.shapeId}>
              <div className="shape-reference-admin-preview" aria-hidden="true">
                {effectiveStyle === 'photo'
                  ? <ShapeReferenceImage name={shape.name} src={shape.refPhotoUrl} iconKey={shape.iconKey} fallbackSize={38} />
                  : <ShapeIcon iconKey={shape.iconKey} size={42} />}
              </div>
              <div className="shape-reference-admin-copy">
                {/* The flame lives on the card, the way it does on a colour
                    card, so featuring a shape doesn't mean opening the
                    shapes & sizes picker to find it. */}
                <strong><HotMark categoryId={categoryId} kind="shape" ids={[shape.shapeId]} name={shape.name} />{shape.name}</strong>
                <span>{effectiveStyle === 'photo' ? 'Gemstone photo' : 'Faceted vector'}</span>
              </div>
              <div className="shape-reference-admin-actions">
                <div className="cat-badge-toggle" aria-label={`${shape.name} reference style`}>
                  <button type="button" className={effectiveStyle === 'vector' ? 'active' : ''} aria-pressed={effectiveStyle === 'vector'} disabled={busy === shape.shapeId} onClick={() => setStyle(shape.shapeId, 'vector')}>Vector</button>
                  <button type="button" className={effectiveStyle === 'photo' ? 'active' : ''} aria-pressed={effectiveStyle === 'photo'} disabled={!canUsePhoto || busy === shape.shapeId} onClick={() => setStyle(shape.shapeId, 'photo')} title={canUsePhoto ? 'Show the gemstone photo' : 'Upload a gemstone photo first'}>Gemstone</button>
                </div>
                <label className="shape-reference-upload">
                  {canUsePhoto ? 'Replace photo' : 'Add photo'}
                  <input type="file" accept="image/png,image/webp,image/jpeg" disabled={busy === shape.shapeId} onChange={(event) => { uploadPhoto(shape.shapeId, event.target.files?.[0]); event.currentTarget.value = ''; }} />
                </label>
              </div>
            </article>
          );
        })}
      </div>
      {message && <p className="admin-inline-status" role="status">{message}</p>}
    </section>
  );
}
