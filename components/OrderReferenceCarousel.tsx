'use client';

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
  // The colour chart used to lead the strip. On a phone the strip shows about
  // one tile, so the chart took the whole reference area and a buyer had to
  // swipe past a grid of swatch codes -- unreadable at that size -- before
  // seeing a single stone. Photos lead now and the chart sits at the end,
  // still one tap from the zoomable full-screen view.
  return <ReferenceStrip key={setKey} {...result} categoryName={categoryName} shapes={shapes} colors={colors} colorChartUrl={colorChartUrl} />;
}
// A borderless row of reference photos. The strip shows as many photos as the
// width allows (one on a phone, several on desktop) and scrolls sideways with
// snap; arrow buttons appear only while there is more to see in that direction.
function ReferenceStrip({photos,matching,categoryName,shapes,colors,colorChartUrl}: {
  photos:OrderReferencePhoto[];matching:boolean;fallback:boolean;categoryName:string;shapes:NamedOption[];colors:NamedOption[];colorChartUrl?:string|null;
}) {
  const [index,setIndex] = useState<number|null>(null);
  const [failed,setFailed] = useState<number[]>([]);
  const [edges,setEdges] = useState({prev:false,next:false});
  const [chartOpen,setChartOpen] = useState(false);
  const [chartZoom,setChartZoom] = useState(1);
  const [chartFailed,setChartFailed] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const chartDialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement|null>(null);
  const chartOpener = useRef<HTMLButtonElement|null>(null);
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
  },[count,colorChartUrl]);
  useEffect(()=>{if(index!==null && !dialog.current?.open) dialog.current?.showModal();},[index]);
  useEffect(()=>{if(chartOpen && !chartDialog.current?.open) chartDialog.current?.showModal();},[chartOpen]);

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
  function closeChart() {chartDialog.current?.close();}
  const active = index===null ? null : photos[index];

  return <aside className="po-ref-strip" aria-label={matching ? 'Product photos matching your options' : 'Product reference photos'} aria-roledescription="carousel">
    <div className="po-ref-strip-track" ref={track}>
      {photos.map((photo,i)=><button key={photo.id} type="button" className="po-ref-strip-tile" aria-label={`Enlarge ${altFor(photo,i)}`}
        onClick={e=>{opener.current=e.currentTarget;setIndex(i);}}>
        {failed.includes(photo.id) ? <span className="po-reference-unavailable">Image unavailable</span>
          : <img src={photo.url!} alt={altFor(photo,i)} loading={i<4?'eager':'lazy'} decoding="async" onError={()=>markFailed(photo.id)} />}
      </button>)}
      {colorChartUrl && <button type="button" className="po-ref-strip-tile po-ref-strip-chart-tile" aria-label={`Enlarge ${categoryName} color chart`}
        onClick={e=>{chartOpener.current=e.currentTarget;setChartOpen(true);}}>
        {chartFailed ? <span className="po-reference-unavailable">Chart unavailable</span>
          : <img src={colorChartUrl} alt={`${categoryName} color chart`} loading="lazy" decoding="async" onError={()=>setChartFailed(true)} />}
        {/* The chart is a dense grid of 40-plus swatch codes shown here at
            about 200px, where none of it is readable -- without saying so it
            reads as a broken image rather than something you open. */}
        <span className="po-ref-strip-tile-label">Color chart — tap to zoom</span>
      </button>}
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
    {colorChartUrl && chartOpen && <dialog ref={chartDialog} className="color-chart-dialog" aria-label={`${categoryName} color chart viewer`} onCancel={e=>{e.preventDefault();closeChart();}} onClose={()=>{setChartOpen(false);setChartZoom(1);chartOpener.current?.focus();}}>
      <header><strong>{categoryName} · Color chart</strong><button type="button" autoFocus aria-label="Close color chart" onClick={closeChart}>✕</button></header>
      <div className="color-chart-viewer"><div style={{width:`${chartZoom*100}%`,height:`${chartZoom*100}%`}}><img src={colorChartUrl} alt={`${categoryName} color chart`} /></div></div>
      <footer><button type="button" disabled={chartZoom===1} onClick={()=>setChartZoom(v=>Math.max(1,v-1))} aria-label="Zoom out color chart">−</button><span aria-live="polite">{chartZoom===1?'Fit':`${chartZoom}×`}</span><button type="button" disabled={chartZoom===4} onClick={()=>setChartZoom(v=>Math.min(4,v+1))} aria-label="Zoom in color chart">+</button><a href={colorChartUrl} target="_blank" rel="noopener noreferrer">Open original ↗</a></footer>
    </dialog>}
  </aside>;
}
