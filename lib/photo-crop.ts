// rotate: quarter turns clockwise (0/90/180/270); straighten: fine clockwise
// degrees (-45..45); flip: mirror left-right before rotating. All three are
// optional so crops saved before they existed keep working unchanged.
export type CropSettings = { x: number; y: number; zoom: number; aspect: number; rotate?: number; straighten?: number; flip?: boolean };
export type SavedCrop = CropSettings & { path: string };
export const DEFAULT_CROP: CropSettings = { x: 50, y: 50, zoom: 1, aspect: 1 };
export function validCrop(value: unknown): value is CropSettings {
  if (!value || typeof value !== 'object') return false;
  const v = value as CropSettings;
  return [v.x,v.y,v.zoom,v.aspect].every(n=>typeof n==='number' && Number.isFinite(n)) &&
    v.x>=0 && v.x<=100 && v.y>=0 && v.y<=100 && v.zoom>=1 && v.zoom<=5 && v.aspect>=0.1 && v.aspect<=10 &&
    (v.rotate===undefined || [0,90,180,270].includes(v.rotate)) &&
    (v.straighten===undefined || (typeof v.straighten==='number' && Number.isFinite(v.straighten) && Math.abs(v.straighten)<=45)) &&
    (v.flip===undefined || typeof v.flip==='boolean');
}
export function isTransformed(crop: CropSettings) {
  return !!(crop.rotate || crop.straighten || crop.flip);
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
/**
 * Crop geometry for an upright original of w0 x h0, once flipped and turned a
 * whole number of quarter turns (giving W x H). The crop box (bw x bh, aspect
 * `aspect`) is centred at (cx, cy) measured from that image's centre and is
 * tilted by -straighten against it, so it is upright in the output. The box is
 * the largest that fits inside the image at that tilt, divided by zoom, so no
 * empty corner ever shows; x/y slide the centre within (-mx..mx, -my..my).
 * With no rotation this is the same rectangle cropRect() gives.
 */
export function cropGeometry(w0:number,h0:number,crop:CropSettings) {
  const quarter=((crop.rotate||0)/90)%2===1;
  const W=quarter?h0:w0,H=quarter?w0:h0;
  const angle=((crop.straighten||0)*Math.PI)/180;
  const c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
  const fit=Math.min(W/(crop.aspect*c+s),H/(crop.aspect*s+c));
  const bh=fit/crop.zoom,bw=bh*crop.aspect;
  const ex=(bw*c+bh*s)/2,ey=(bw*s+bh*c)/2;
  const mx=Math.max(0,W/2-ex),my=Math.max(0,H/2-ey);
  return {W,H,angle,bw,bh,mx,my,cx:(crop.x/50-1)*mx,cy:(crop.y/50-1)*my};
}
/** Box centre in S (unrotated) coordinates back to x/y percentages. */
export function positionFor(geometry:{mx:number;my:number},cx:number,cy:number) {
  const pct=(v:number,m:number)=>m>0?Math.max(0,Math.min(100,(v/m+1)*50)):50;
  return {x:pct(cx,geometry.mx),y:pct(cy,geometry.my)};
}
/**
 * The pixel rectangle to extract after the flipped original has been rotated
 * by rotate+straighten degrees (sharp grows the canvas to the rotated bounds,
 * centred, to canvasW x canvasH), so the extract is an upright rectangle.
 */
export function rotatedPixelCrop(w0:number,h0:number,crop:CropSettings,canvasW:number,canvasH:number) {
  const g=cropGeometry(w0,h0,crop);
  const c=Math.cos(g.angle),s=Math.sin(g.angle);
  const ox=g.cx*c-g.cy*s,oy=g.cx*s+g.cy*c;
  const left=Math.max(0,Math.round(canvasW/2+ox-g.bw/2)),top=Math.max(0,Math.round(canvasH/2+oy-g.bh/2));
  return {left,top,width:Math.max(1,Math.min(canvasW-left,Math.round(g.bw))),height:Math.max(1,Math.min(canvasH-top,Math.round(g.bh)))};
}
