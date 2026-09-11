export type OrderReferencePhoto = {
  id: number;
  url: string | null;
  shapeIds: number[];
  colorIds: number[];
  sizeIds: number[];
};
export function referencePhotos(photos: OrderReferencePhoto[], selection: {shapeIds:number[];colorIds:number[];sizeIds:number[]}) {
  const available = photos.filter(photo => !!photo.url);
  const filtered = available.filter(photo =>
    (['shapeIds','colorIds','sizeIds'] as const).every(key => selection[key].length === 0 || selection[key].some(id => photo[key].includes(id)))
  );
  const hasSelection = Object.values(selection).some(ids => ids.length > 0);
  return {photos:filtered.length ? filtered : available, matching:hasSelection && filtered.length > 0, fallback:hasSelection && filtered.length === 0};
}
