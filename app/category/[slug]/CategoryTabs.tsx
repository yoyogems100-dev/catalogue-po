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
  /** Set when this photo is another angle of a grouped stone. */
  parentId?: number | null;
  productCode?: string | null;
  notes?: string | null;
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
  colorChartUrl,
  colorPalettes,
  loggedIn,
  pricing,
  priceUnit
}: {
  categoryId: number;
  categoryName: string;
  whatsappNumber?: string;
  shapes: Ref[];
  colors: Ref[];
  tags: Ref[];
  sizes: Size[];
  photos: Photo[];
  colorChartUrl?: string | null;
  colorPalettes?: Palette[];
  loggedIn?: boolean;
  pricing?: CategoryPricing;
  /** What one unit of price buys in this category -- "piece" unless the
      category says otherwise (Rainbow Corundum is priced per strip). */
  priceUnit?: string | null;
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

        <div hidden={tab !== 'order'} id="cat-tabpanel-order" role="tabpanel" aria-labelledby="cat-tab-order">
        <POSelector
          categoryId={categoryId}
          categoryName={categoryName}
          whatsappNumber={whatsappNumber}
          shapes={shapes}
          colors={colors}
          sizes={sizes}
          colorPalettes={colorPalettes}
          pricing={pricing}
          photos={photos}
          colorChartUrl={colorChartUrl}
          loggedIn={loggedIn}
          active={tab === 'order'}
        />
        </div>
      {tab === 'photos' && (
        <div id="cat-tabpanel-photos" role="tabpanel" aria-labelledby="cat-tab-photos">
        <CategoryClient
          categoryId={categoryId}
          categoryName={categoryName}
          shapes={shapes}
          colors={colors}
          tags={tags}
          sizes={sizes}
          photos={photos}
          pricing={pricing}
          priceUnit={priceUnit}
          onRaiseOrder={() => setTab('order')}
        />
        </div>
      )}
    </>
  );
}
