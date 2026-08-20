'use client';

import { useState } from 'react';
import POSelector from '@/components/POSelector';
import CategoryClient from './CategoryClient';
import type { CategoryPricing } from '@/lib/pricing-calc';

type Ref = { id: number; name: string; iconKey?: string | null; hex?: string | null; refPhotoUrl?: string | null };
type Size = { id: number; shape_id: number; size_mm: string };
type Photo = {
  id: number;
  url: string | null;
  shapeIds: number[];
  sizeIds: number[];
  colorIds: number[];
  tag_ids: number[];
};

type Palette = { id: number; name: string; memberIds: number[] };

export default function CategoryTabs({
  categoryId,
  categoryName,
  whatsappNumber,
  shapes,
  colors,
  tags,
  sizes,
  photos,
  colorPalettes,
  pricing
}: {
  categoryId: number;
  categoryName: string;
  whatsappNumber?: string;
  shapes: Ref[];
  colors: Ref[];
  tags: Ref[];
  sizes: Size[];
  photos: Photo[];
  colorPalettes?: Palette[];
  pricing?: CategoryPricing;
}) {
  const [tab, setTab] = useState<'order' | 'photos'>('order');

  return (
    <>
      <div className="cat-tabs" role="tablist" aria-label="Category actions">
        <button
          id="cat-tab-order"
          role="tab"
          aria-selected={tab === 'order'}
          aria-controls="cat-tabpanel-order"
          className={`cat-tab ${tab === 'order' ? 'active' : ''}`}
          onClick={() => setTab('order')}
        >
          Raise Purchase Order
        </button>
        <button
          id="cat-tab-photos"
          role="tab"
          aria-selected={tab === 'photos'}
          aria-controls="cat-tabpanel-photos"
          className={`cat-tab ${tab === 'photos' ? 'active' : ''}`}
          onClick={() => setTab('photos')}
        >
          Explore Photos {photos.length > 0 ? `(${photos.length})` : ''}
        </button>
      </div>

      {tab === 'order' ? (
        <div id="cat-tabpanel-order" role="tabpanel" aria-labelledby="cat-tab-order">
        <POSelector
          categoryId={categoryId}
          categoryName={categoryName}
          whatsappNumber={whatsappNumber}
          shapes={shapes}
          colors={colors}
          sizes={sizes}
          colorPalettes={colorPalettes}
          pricing={pricing}
        />
        </div>
      ) : (
        <div id="cat-tabpanel-photos" role="tabpanel" aria-labelledby="cat-tab-photos">
        <CategoryClient
          categoryId={categoryId}
          categoryName={categoryName}
          shapes={shapes}
          colors={colors}
          tags={tags}
          sizes={sizes}
          photos={photos}
        />
        </div>
      )}
    </>
  );
}
