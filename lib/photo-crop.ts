export type CropSettings = { x: number; y: number; zoom: number; aspect: number };
export type SavedCrop = CropSettings & { path: string };
export const DEFAULT_CROP: CropSettings = { x: 50, y: 50, zoom: 1, aspect: 1 };
export function validCrop(value: unknown): value is CropSettings {
  if (!value || typeof value !== 'object') return false;
  const v = value as CropSettings;
  return [v.x,v.y,v.zoom,v.aspect].every(n=>typeof n==='number' && Number.isFinite(n)) &&
    v.x>=0 && v.x<=100 && v.y>=0 && v.y<=100 && v.zoom>=1 && v.zoom<=5 && v.aspect>=0.1 && v.aspect<=10;
}
// Normalized source rectangle; shared by the browser preview and saved image.
export function cropRect(sourceAspect: number, crop: CropSettings) {
  const width = Math.min(1,crop.aspect/sourceAspect)/crop.zoom;
  const height = Math.min(1,sourceAspect/crop.aspect)/crop.zoom;
  return { x:(1-width)*crop.x/100, y:(1-height)*crop.y/100, width, height };
}
export function pixelCrop(width:number,height:number,crop:CropSettings) {
  const rect=cropRect(width/height,crop);
  const left=Math.round(rect.x*width),top=Math.round(rect.y*height);
  return {left,top,width:Math.max(1,Math.min(width-left,Math.round(rect.width*width))),height:Math.max(1,Math.min(height-top,Math.round(rect.height*height)))};
}
