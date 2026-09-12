'use client';

import { useEffect, useRef, useState } from 'react';
import { referencePhotos, type OrderReferencePhoto } from '@/lib/order-reference-photos';

type NamedOption = {id:number;name:string};
export default function OrderReferenceCarousel({photos,categoryName,shapeIds,colorIds,sizeIds,shapes,colors}: {
  photos:OrderReferencePhoto[]; categoryName:string;
  shapeIds:number[];colorIds:number[];sizeIds:number[];
  shapes:NamedOption[];colors:NamedOption[];
}) {
  const result = referencePhotos(photos,{shapeIds,colorIds,sizeIds});
  // Reset only when the actual reference set changes, not on quantity edits.
  const setKey = result.photos.map(photo=>photo.id).join(',');
  return <ReferenceFrame key={setKey} {...result} categoryName={categoryName} shapes={shapes} colors={colors} />;
}
function ReferenceFrame({photos,matching,fallback,categoryName,shapes,colors}: {
  photos:OrderReferencePhoto[];matching:boolean;fallback:boolean;categoryName:string;shapes:NamedOption[];colors:NamedOption[];
}) {
  const [index,setIndex] = useState(0);
  const [expanded,setExpanded] = useState(false);
  const [loaded,setLoaded] = useState<number[]>([]);
  const [failed,setFailed] = useState<number[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const swiped = useRef(false);
  const touchStart = useRef<number|null>(null);
  const photo = photos[index];
  const count = photos.length;
  const details = photo ? [...shapes.filter(s=>photo.shapeIds.includes(s.id)).map(s=>s.name),...colors.filter(c=>photo.colorIds.includes(c.id)).map(c=>c.name)].join(' · ') : '';
  const alt = `${categoryName}${details ? ` — ${details}` : ''}, reference ${index+1} of ${count}`;
  function move(delta:number) {setIndex(current=>(current+delta+count)%count);}
  useEffect(()=>{if(expanded) dialog.current?.showModal();},[expanded]);
  function close() {dialog.current?.close();setExpanded(false);opener.current?.focus();}
  function image(large=false) {
    return failed.includes(photo.id) ? <span className="po-reference-unavailable">Image unavailable</span> : <img src={photo.url!} alt={alt} decoding="async" onLoad={()=>setLoaded(ids=>ids.includes(photo.id)?ids:[...ids,photo.id])} onError={()=>setFailed(ids=>ids.includes(photo.id)?ids:[...ids,photo.id])} className={large?'po-reference-large-image':''} />;
  }
  if (!photo) return null;
  return <aside className="po-reference" aria-label="Product reference photos" aria-roledescription="carousel">
    <div className="po-reference-heading"><h3>Product reference</h3><span>{matching?'Matching your options':'Category photos'}</span></div>
    <button ref={opener} type="button" className="po-reference-image" aria-label="Enlarge product reference photo" onClick={()=>{if(!swiped.current)setExpanded(true);swiped.current=false;}}
      onPointerDown={e=>{touchStart.current=e.clientX;swiped.current=false;}}
      onPointerCancel={()=>{touchStart.current=null;}}
      onPointerUp={e=>{if(touchStart.current!==null && Math.abs(e.clientX-touchStart.current)>40 && count>1) {move(e.clientX<touchStart.current?1:-1);swiped.current=true;}touchStart.current=null;}}>
      {!loaded.includes(photo.id) && !failed.includes(photo.id) && <span className="po-reference-loading">Loading reference…</span>}{image()}<span className="po-reference-expand" aria-hidden="true">⤢</span>
    </button>
    <div className="po-reference-meta">
      <div className="po-reference-controls">
        <button type="button" aria-label="Previous reference photo" disabled={count<2} onClick={()=>move(-1)}>‹</button>
        <span aria-live="polite" aria-atomic="true">{index+1} / {count}</span>
        <button type="button" aria-label="Next reference photo" disabled={count<2} onClick={()=>move(1)}>›</button>
      </div>
      <p className="po-reference-caption" title={details}>{details || categoryName}</p>
      <p className="po-reference-hint">{fallback?'No photo matches these options yet. Showing category references.':'Tap photo to enlarge. For visual reference.'}</p>
    </div>
    {expanded && <dialog ref={dialog} className="po-reference-dialog" aria-label="Enlarged product reference" onCancel={close} onClose={()=>{setExpanded(false);opener.current?.focus();}} onClick={e=>{if(e.target===e.currentTarget)close();}} onKeyDown={e=>{if(e.key==='ArrowLeft'&&count>1){e.preventDefault();move(-1);}if(e.key==='ArrowRight'&&count>1){e.preventDefault();move(1);}}}>
      <div className="po-reference-dialog-head"><strong>{categoryName} · Reference photos</strong><button type="button" autoFocus onClick={close} aria-label="Close enlarged reference">✕</button></div>
      {image(true)}
      <div className="po-reference-controls"><button type="button" aria-label="Previous enlarged reference" disabled={count<2} onClick={()=>move(-1)}>‹</button><span aria-live="polite">{index+1} / {count}</span><button type="button" aria-label="Next enlarged reference" disabled={count<2} onClick={()=>move(1)}>›</button></div>
      <p>{details || categoryName}</p>
    </dialog>}
  </aside>;
}
