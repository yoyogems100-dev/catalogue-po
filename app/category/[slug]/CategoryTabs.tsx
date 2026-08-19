'use client';

import { useState } from 'react';
import POSelector from '@/components/POSelector';
import CategoryClient from './CategoryClient';

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
  colorPalettes
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
}) {
  const [tab, setTab] = useState<'order' | 'photos'>('order');

  return (
    <>
      <div className="cat-tabs">
        <button className={`cat-tab ${tab === 'order' ? 'active' : ''}`} onClick={() => setTab('order')}>
          Raise Purchase Order
        </button>
        <button className={`cat-tab ${tab === 'photos' ? 'active' : ''}`} onClick={() => setTab('photos')}>
          Explore Photos {photos.length > 0 ? `(${photos.length})` : ''}
        </button>
      </div>

      {tab === 'order' ? (
        <POSelector
          categoryId={categoryId}
          categoryName={categoryName}
          whatsappNumber={whatsappNumber}
          shapes={shapes}
          colors={colors}
          sizes={sizes}
          colorPalettes={colorPalettes}
        />
      ) : (
        <CategoryClient
          categoryName={categoryName}
          whatsappNumber={whatsappNumber}
          shapes={shapes}
          colors={colors}
          tags={tags}
          sizes={sizes}
          photos={photos}
        />
      )}
    </>
  );
}
