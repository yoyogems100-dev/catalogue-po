'use client';

import ColorChart from './ColorChart';
import { useEffect, useRef, useState } from 'react';
import { referencePhotos, type OrderReferencePhoto } from '@/lib/order-reference-photos';

type NamedOption = {id:number;name:string};
export default function OrderReferenceCarousel({photos,categoryName,shapeIds,colorIds,sizeIds,shapes,colors,colorChartUrl}: {
  photos:OrderReferencePhoto[]; categoryName:string; colorChartUrl?:string|null;
  shapeIds:number[];colorIds:number[];sizeIds:number[];
  shapes:NamedOption[];colors:NamedOption[];
}) {
  const result = referencePhotos(photos,{shapeIds,colorIds,sizeIds});
  // Reset only when the actual reference set changes, not on quantity edits.
  const setKey = result.photos.map(photo=>photo.id).join(',');
  if (!result.photos.length && !colorChartUrl) return null;
  // One reference beside the controls, not two. Where a category has a colour
  // chart, that IS the reference a buyer needs while choosing a colour, so it
  // stands alone; otherwise the filtered product photos take its place. Photos
  // for browsing live on the Explore Photos tab rather than being repeated
  // under the order form.
  if (colorChartUrl) {
    return <div className="po-reference-pair po-reference-chart-only">
      <ColorChart url={colorChartUrl} categoryName={categoryName} />
    </div>;
  }
  return <ReferenceStrip key={setKey} {...result} categoryName={categoryName} shapes={shapes} colors={colors} />;
}
// A borderless row of reference photos. The strip shows as many photos as the
// width allows (one on a phone, several on desktop) and scrolls sideways with
// snap; arrow buttons appear only while there is more to see in that direction.
function ReferenceStrip({photos,matching,categoryName,shapes,colors}: {
  photos:OrderReferencePhoto[];matching:boolean;fallback:boolean;categoryName:string;shapes:NamedOption[];colors:NamedOption[];
}) {
  const [index,setIndex] = useState<number|null>(null);
  const [failed,setFailed] = useState<number[]>([]);
  const [edges,setEdges] = useState({prev:false,next:false});
  const track = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement|null>(null);
  const count = photos.length;
  const describe = (photo:OrderReferencePhoto) => [...shapes.filter(s=>photo.shapeIds.includes(s.id)).map(s=>s.name),...colors.filter(c=>photo.colorIds.includes(c.id)).map(c=>c.name)].join(' · ');
  const altFor = (photo:OrderReferencePhoto, i:number) => { const d = describe(photo); return `${categoryName}${d ? ` — ${d}` : ''}, reference ${i+1} of ${count}`; };
  const markFailed = (id:number) => setFailed(ids=>ids.includes(id)?ids:[...ids,id]);

  useEffect(()=>{
    const el = track.current;
    if (!el) return;
    const update = () => setEdges({prev: el.scrollLeft > 4, next: el.scrollLeft + el.clientWidth < el.scrollWidth - 4});
    update();
    el.addEventListener('scroll', update, {passive:true});
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(el);
    return () => { el.removeEventListener('scroll', update); observer?.disconnect(); };
  },[count]);
  useEffect(()=>{if(index!==null && !dialog.current?.open) dialog.current?.showModal();},[index]);

  function scrollPage(direction:number) {
    const el = track.current;
    if (!el) return;
    const tile = el.firstElementChild as HTMLElement | null;
    const step = tile ? tile.offsetWidth + parseFloat(getComputedStyle(el).columnGap || '0') : el.clientWidth;
    // Move a whole visible page, but never less than one tile.
    const perPage = Math.max(1, Math.floor((el.clientWidth + 1) / step));
    el.scrollBy({left: direction * perPage * step, behavior: 'smooth'});
  }
  function move(delta:number) {setIndex(current=>current===null?current:(current+delta+count)%count);}
  function close() {dialog.current?.close();}
  const active = index===null ? null : photos[index];

  return <aside className="po-ref-strip" aria-label={matching ? 'Product photos matching your options' : 'Product reference photos'} aria-roledescription="carousel">
    <div className="po-ref-strip-track" ref={track}>
      {photos.map((photo,i)=><button key={photo.id} type="button" className="po-ref-strip-tile" aria-label={`Enlarge ${altFor(photo,i)}`}
        onClick={e=>{opener.current=e.currentTarget;setIndex(i);}}>
        {failed.includes(photo.id) ? <span className="po-reference-unavailable">Image unavailable</span>
          : <img src={photo.url!} alt={altFor(photo,i)} loading={i<4?'eager':'lazy'} decoding="async" onError={()=>markFailed(photo.id)} />}
      </button>)}
    </div>
    {edges.prev && <button type="button" className="po-ref-strip-nav po-ref-strip-prev" aria-label="Previous reference photos" onClick={()=>scrollPage(-1)}>‹</button>}
    {edges.next && <button type="button" className="po-ref-strip-nav po-ref-strip-next" aria-label="Next reference photos" onClick={()=>scrollPage(1)}>›</button>}
    {active && index!==null && <dialog ref={dialog} className="po-reference-dialog" aria-label="Enlarged product reference" onCancel={e=>{e.preventDefault();close();}} onClose={()=>{setIndex(null);opener.current?.focus();}} onClick={e=>{if(e.target===e.currentTarget)close();}} onKeyDown={e=>{if(e.key==='ArrowLeft'&&count>1){e.preventDefault();move(-1);}if(e.key==='ArrowRight'&&count>1){e.preventDefault();move(1);}}}>
      <div className="po-reference-dialog-head"><strong>{categoryName} · Reference photos</strong><button type="button" autoFocus onClick={close} aria-label="Close enlarged reference">✕</button></div>
      {failed.includes(active.id) ? <span className="po-reference-unavailable">Image unavailable</span>
        : <img src={active.url!} alt={altFor(active,index)} className="po-reference-large-image" onError={()=>markFailed(active.id)} />}
      <div className="po-reference-controls"><button type="button" aria-label="Previous enlarged reference" disabled={count<2} onClick={()=>move(-1)}>‹</button><span aria-live="polite">{index+1} / {count}</span><button type="button" aria-label="Next enlarged reference" disabled={count<2} onClick={()=>move(1)}>›</button></div>
      <p>{describe(active) || categoryName}</p>
    </dialog>}
  </aside>;
}
