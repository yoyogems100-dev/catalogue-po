'use client';

import { useState } from 'react';
import type { OrderReferencePhoto } from '@/lib/order-reference-photos';

/**
 * Reference photos beneath the builder, in the space the requirement panel used
 * to occupy. A static list of lines there was something buyers scrolled past;
 * photos are a reason to stay on the page while choosing.
 *
 * The colour chart leads the strip when the category has one: it is a tall
 * portrait document (roughly 1400x1900), illegible at thumbnail size, so it is
 * a labelled way in to the full-screen view rather than a preview pretending to
 * be readable -- and it only loads once opened.
 */
export default function CategoryPhotoGallery({ photos, categoryName, colorChartUrl }: {
  photos: OrderReferencePhoto[];
  categoryName: string;
  colorChartUrl?: string | null;
}) {
  const [zoomed, setZoomed] = useState<{ src: string; alt: string } | null>(null);
  const usable = photos.filter((p) => p.url);

  if (!usable.length && !colorChartUrl) return null;

  return (
    <section className="po-card po-gallery-card" aria-label={`${categoryName} reference photos`}>
      <div className="po-gallery-head">
        <h2 className="po-heading">Reference photos</h2>
        <span className="po-gallery-count">{usable.length} {usable.length === 1 ? 'photo' : 'photos'}</span>
      </div>

      <div className="po-gallery-grid">
        {colorChartUrl && (
          <button
            type="button"
            className="po-gallery-tile po-gallery-tile--chart"
            onClick={() => setZoomed({ src: colorChartUrl, alt: `${categoryName} colour chart` })}
          >
            <span className="po-gallery-chart-strip" aria-hidden="true" />
            <span className="po-gallery-chart-label">Colour chart</span>
          </button>
        )}
        {usable.map((photo) => (
          <button
            type="button"
            key={photo.id}
            className="po-gallery-tile"
            onClick={() => setZoomed({ src: photo.url!, alt: `${categoryName} reference photo` })}
          >
            <img src={photo.url!} alt={`${categoryName} reference`} loading="lazy" />
          </button>
        ))}
      </div>

      {zoomed && (
        <div
          className="po-gallery-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={zoomed.alt}
          onClick={() => setZoomed(null)}
        >
          <button type="button" className="po-gallery-close" aria-label="Close">&times;</button>
          <img src={zoomed.src} alt={zoomed.alt} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </section>
  );
}
