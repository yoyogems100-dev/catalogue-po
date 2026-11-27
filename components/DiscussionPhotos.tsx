'use client';

import { useEffect, useState } from 'react';
import { discussionPhotoUrl } from '@/lib/discussions';

// Photos attached to one discussed item: small thumbnails that open full
// screen (swipe-free prev/next buttons and arrow keys; Esc or tap outside closes).
export default function DiscussionPhotos({ paths, label, onRemove }: { paths: string[]; label: string; onRemove?: (path: string) => void }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') setOpen((i) => (i === null ? i : (i + 1) % paths.length));
      if (e.key === 'ArrowLeft') setOpen((i) => (i === null ? i : (i - 1 + paths.length) % paths.length));
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [open, paths.length]);

  if (!paths.length) return null;
  return (
    <>
      <div className="discussion-photos">
        {paths.map((p, i) => (
          <span key={p} className="discussion-photo">
            <button type="button" className="discussion-photo-thumb" onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1} of ${label}`}>
              <img src={discussionPhotoUrl(p)} alt="" loading="lazy" />
            </button>
            {onRemove && <button type="button" className="discussion-photo-remove" aria-label={`Remove photo ${i + 1}`} onClick={() => onRemove(p)}>×</button>}
          </span>
        ))}
      </div>
      {open !== null && paths[open] && (
        <div className="discussion-viewer" role="dialog" aria-modal="true" aria-label={`${label} photo ${open + 1} of ${paths.length}`}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
          <img src={discussionPhotoUrl(paths[open])} alt={`${label}, photo ${open + 1}`} />
          <button type="button" className="discussion-viewer-close" aria-label="Close" onClick={() => setOpen(null)}>×</button>
          {paths.length > 1 && <>
            <button type="button" className="discussion-viewer-nav prev" aria-label="Previous photo" onClick={() => setOpen((open - 1 + paths.length) % paths.length)}>‹</button>
            <button type="button" className="discussion-viewer-nav next" aria-label="Next photo" onClick={() => setOpen((open + 1) % paths.length)}>›</button>
            <span className="discussion-viewer-count">{open + 1} / {paths.length}</span>
          </>}
        </div>
      )}
    </>
  );
}
