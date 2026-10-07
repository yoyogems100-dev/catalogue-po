'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cropGeometry, DEFAULT_CROP, positionFor, type CropSettings, type SavedCrop } from '@/lib/photo-crop';

export default function PhotoCropEditor({photoId,photoCrop,coverCrop,coverOnly=false,isCover=false}:{photoId:number;photoCrop?:SavedCrop|null;coverCrop?:SavedCrop|null;coverOnly?:boolean;isCover?:boolean}) {
  const [target,setTarget]=useState<'photo'|'cover'|null>(null);
  const [message,setMessage]=useState('');const router=useRouter();
  return <div className="photo-crop-actions">
    {!coverOnly && <button type="button" className="btn-ghost" onClick={()=>setTarget('photo')}>Crop photo</button>}
    {(coverOnly||isCover) && <button type="button" className="btn-ghost" onClick={()=>setTarget('cover')}>Adjust cover</button>}
    {message && <small role="status">{message}</small>}
    {target && <CropDialog photoId={photoId} target={target} initial={(target==='cover'?coverCrop:photoCrop)||null} onClose={()=>setTarget(null)} onSaved={reset=>{setMessage(reset?(target==='cover'?'Cover reset to photo crop / original.':'Original photo restored.'):'Crop saved.');setTarget(null);router.refresh();}} />}
  </div>;
}

// iPhone Photos' crop ratios. Each fixed ratio can be turned portrait or landscape.
const RATIOS=[{id:'original',name:'Original'},{id:'free',name:'Freeform'},{id:'square',name:'Square',value:1},{id:'16:9',name:'16:9',value:16/9},{id:'4:3',name:'4:3',value:4/3},{id:'3:2',name:'3:2',value:3/2},{id:'5:4',name:'5:4',value:5/4},{id:'7:5',name:'7:5',value:7/5},{id:'5:3',name:'5:3',value:5/3}] as const;
type RatioId=typeof RATIOS[number]['id'];
const near=(a:number,b:number)=>Math.abs(a-b)<0.005;
const clampZoom=(z:number)=>Math.max(1,Math.min(5,z));
function ratioFor(aspect:number,sourceAspect:number):{id:RatioId;portrait:boolean} {
  if(near(aspect,sourceAspect))return {id:'original',portrait:aspect<1};
  for(const r of RATIOS)if('value' in r&&(near(aspect,r.value)||near(aspect,1/r.value)))return {id:r.id,portrait:aspect<1};
  return {id:'free',portrait:aspect<1};
}

function CropDialog({photoId,target,initial,onClose,onSaved}:{photoId:number;target:'photo'|'cover';initial:CropSettings|null;onClose:()=>void;onSaved:(reset:boolean)=>void}) {
  const start={...DEFAULT_CROP,...initial};
  const [crop,setCrop]=useState<CropSettings>({...start,aspect:target==='cover'?1:start.aspect,rotate:start.rotate||0,straighten:start.straighten||0,flip:!!start.flip});
  // Cumulative quarter turns, so the 90° animation always turns the short way.
  const [spin,setSpin]=useState(start.rotate||0);const [animate,setAnimate]=useState(false);
  const [ratio,setRatio]=useState<{id:RatioId;portrait:boolean}>({id:target==='cover'?'square':'original',portrait:false});
  const [source,setSource]=useState('');const [natural,setNatural]=useState({w:1,h:1});const [ready,setReady]=useState(false);
  const [stageSize,setStageSize]=useState({w:320,h:320});const [active,setActive]=useState(false);
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);const stage=useRef<HTMLDivElement>(null);
  const pointers=useRef(new Map<number,{x:number;y:number}>());
  const gesture=useRef<{kind:'pan'|'pinch'|'corner';x:number;y:number;dist:number;crop:CropSettings;sx:number;sy:number;k:number}|null>(null);
  useEffect(()=>{dialog.current?.showModal();},[]);
  useEffect(()=>{
    const controller=new AbortController();let url='';
    (async()=>{try {const response=await fetch(`/api/admin/photos/${photoId}/crop`,{signal:controller.signal});
      if(!response.ok){const data=await response.json();throw new Error(data.error||'Could not load the original.');}
      url=URL.createObjectURL(await response.blob());setSource(url);
    }catch(err){if(!controller.signal.aborted)setError(err instanceof Error?err.message:'Could not load the original.');}})();
    return()=>{controller.abort();if(url)URL.revokeObjectURL(url);};
  },[photoId]);
  useEffect(()=>{
    const el=stage.current;if(!el)return;
    const observer=new ResizeObserver(([entry])=>setStageSize({w:entry.contentRect.width,h:entry.contentRect.height}));
    observer.observe(el);
    // Trackpad pinch / mouse wheel zoom; needs a non-passive listener to stop the page scrolling.
    const wheel=(e:WheelEvent)=>{e.preventDefault();setCrop(c=>({...c,zoom:clampZoom(c.zoom*Math.exp(-e.deltaY*0.002))}));};
    el.addEventListener('wheel',wheel,{passive:false});
    return()=>{observer.disconnect();el.removeEventListener('wheel',wheel);};
  },[]);

  const quarter=((crop.rotate||0)/90)%2===1;
  const turnedAspect=quarter?natural.h/natural.w:natural.w/natural.h;
  const g=cropGeometry(natural.w,natural.h,crop);
  const pad=20,fw=Math.max(40,Math.min(stageSize.w-pad*2,(stageSize.h-pad*2)*crop.aspect)),fh=fw/crop.aspect;
  const k=fw/g.bw;
  const cos=Math.cos(g.angle),sin=Math.sin(g.angle);
  const offset={x:-(g.cx*cos-g.cy*sin)*k,y:-(g.cx*sin+g.cy*cos)*k};
  const turn=spin+(crop.straighten||0);

  function setAspect(aspect:number){setCrop(c=>({...c,aspect:Math.max(0.1,Math.min(10,aspect)),zoom:1,x:50,y:50}));}
  function chooseRatio(id:RatioId,portrait=ratio.portrait){
    const r=RATIOS.find(o=>o.id===id)!;setRatio({id,portrait});
    if(id==='original')setAspect(turnedAspect);
    else if('value' in r)setAspect(id==='square'?1:portrait?1/r.value:r.value);
  }
  function flash(){setAnimate(true);window.setTimeout(()=>setAnimate(false),300);}
  // Turns left like the iPhone button; the frame turns with the photo.
  function rotateLeft(){flash();setSpin(s=>s-90);setRatio(r=>({...r,portrait:!r.portrait}));
    setCrop(c=>({...c,rotate:((c.rotate||0)+270)%360,aspect:target==='cover'?1:1/c.aspect,x:50,y:50}));}
  // Mirrors what is in the frame: the turn and tilt reverse, the box stays put.
  function flip(){flash();setSpin(s=>-s);setCrop(c=>({...c,flip:!c.flip,rotate:(360-(c.rotate||0))%360,straighten:-(c.straighten||0),x:100-c.x}));}
  function resetAll(){flash();setSpin(0);setRatio({id:target==='cover'?'square':'original',portrait:natural.w<natural.h});
    setCrop({...DEFAULT_CROP,aspect:target==='cover'?1:natural.w/natural.h,rotate:0,straighten:0,flip:false});}
  function pan(from:CropSettings,dx:number,dy:number,k:number){
    const s=cropGeometry(natural.w,natural.h,from),c=Math.cos(s.angle),n=Math.sin(s.angle);
    // Screen movement turned back into the photo's own axes.
    return {...from,...positionFor(s,s.cx-(dx*c+dy*n)/k,s.cy-(-dx*n+dy*c)/k)};
  }
  // Scale k is the one at gesture start: the frame re-fits while resizing.
  function resizeFrom(from:CropSettings,sx:number,sy:number,dx:number,dy:number,k:number){
    const s=cropGeometry(natural.w,natural.h,from);
    const bw=Math.max(40/k,s.bw+sx*dx/k),bh=Math.max(40/k,s.bh+sy*dy/k);
    const aspect=Math.max(0.1,Math.min(10,bw/bh));
    const fit=cropGeometry(natural.w,natural.h,{...from,aspect,zoom:1}).bh;
    const next={...from,aspect,zoom:clampZoom(fit/bh)};
    // The opposite corner stays where it was.
    const mx=sx*dx/2/k,my=sy*dy/2/k,c=Math.cos(s.angle),n=Math.sin(s.angle);
    const ng=cropGeometry(natural.w,natural.h,next);
    return {...next,...positionFor(ng,s.cx+mx*c+my*n,s.cy-mx*n+my*c)};
  }
  function pointerDown(e:React.PointerEvent,corner?:{sx:number;sy:number}){
    if(!ready||busy)return;e.stopPropagation();try{stage.current?.setPointerCapture(e.pointerId);}catch{}
    pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});setActive(true);
    const pts=[...pointers.current.values()];
    if(corner)gesture.current={kind:'corner',x:e.clientX,y:e.clientY,dist:0,crop,...corner,k};
    else if(pts.length===2)gesture.current={kind:'pinch',x:0,y:0,dist:Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y),crop,sx:0,sy:0,k};
    else if(gesture.current?.kind!=='corner')gesture.current={kind:'pan',x:e.clientX,y:e.clientY,dist:0,crop,sx:0,sy:0,k};
  }
  function pointerMove(e:React.PointerEvent){
    if(!pointers.current.has(e.pointerId))return;pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const start=gesture.current;if(!start)return;const pts=[...pointers.current.values()];
    if(start.kind==='pinch'&&pts.length>=2)setCrop({...start.crop,zoom:clampZoom(start.crop.zoom*Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y)/start.dist)});
    else if(start.kind==='pan')setCrop(pan(start.crop,e.clientX-start.x,e.clientY-start.y,start.k));
    else if(start.kind==='corner'){setRatio(r=>({...r,id:'free'}));setCrop(resizeFrom(start.crop,start.sx,start.sy,e.clientX-start.x,e.clientY-start.y,start.k));}
  }
  function pointerUp(e:React.PointerEvent){
    pointers.current.delete(e.pointerId);
    const rest=[...pointers.current.entries()];
    // Lifting one finger of a pinch carries on as a pan from where things are.
    if(rest.length===1)gesture.current={kind:'pan',x:rest[0][1].x,y:rest[0][1].y,dist:0,crop,sx:0,sy:0,k};
    else if(!rest.length){gesture.current=null;setActive(false);}
  }
  function keyDown(e:React.KeyboardEvent){
    const step=e.shiftKey?40:10;const moves:Record<string,[number,number]>={ArrowLeft:[step,0],ArrowRight:[-step,0],ArrowUp:[0,step],ArrowDown:[0,-step]};
    if(moves[e.key]){e.preventDefault();setCrop(c=>pan(c,...moves[e.key],k));}
    else if(e.key==='+'||e.key==='='){e.preventDefault();setCrop(c=>({...c,zoom:clampZoom(c.zoom*1.1)}));}
    else if(e.key==='-'){e.preventDefault();setCrop(c=>({...c,zoom:clampZoom(c.zoom/1.1)}));}
  }
  async function save(reset=false){
    setBusy(true);setError('');
    try {const response=await fetch(`/api/admin/photos/${photoId}/crop`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target,crop,reset})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Save failed.');onSaved(reset);}
    catch(err){setError(err instanceof Error?err.message:'Could not save. Please retry.');}finally{setBusy(false);}
  }
  const fixed=RATIOS.find(r=>r.id===ratio.id);
  const canTurnRatio=!!fixed&&'value' in fixed&&fixed.id!=='square';
  return <dialog ref={dialog} className="photo-crop-dialog" aria-labelledby="photo-crop-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <div className="photo-crop-head"><h2 id="photo-crop-title">{target==='cover'?'Adjust category cover':'Crop product photo'}</h2><button autoFocus type="button" aria-label="Close crop editor" disabled={busy} onClick={onClose}>×</button></div>
    <div className="photo-crop-body"><p>{target==='cover'?'Preview the square image used on category cards. This does not change the Explore photo.':'Adjust the photo used in Explore and order references. The original is kept for future edits.'}</p>
    <div ref={stage} className={`photo-crop-stage${active?' is-active':''}`} tabIndex={ready?0:-1} role="group" aria-label="Crop area: drag or use arrow keys to move, pinch or + and − to zoom"
      onPointerDown={e=>pointerDown(e)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onKeyDown={keyDown}>
      {source && <img draggable={false} src={source} alt="Original image with crop preview" onLoad={e=>{
          const w=e.currentTarget.naturalWidth,h=e.currentTarget.naturalHeight;setNatural({w,h});setReady(true);
          // A photo with no saved crop starts at its own proportions, like the iPhone.
          if(target==='photo'){if(initial)setRatio(ratioFor(crop.aspect,((crop.rotate||0)/90)%2===1?h/w:w/h));else{setRatio({id:'original',portrait:w<h});setCrop(c=>({...c,aspect:w/h}));}}
        }} onError={()=>{setReady(false);setError('The original image could not be displayed.');}}
        style={{position:'absolute',left:'50%',top:'50%',width:natural.w*k,height:natural.h*k,maxWidth:'none',transformOrigin:'0 0',
          transform:`translate(${offset.x}px,${offset.y}px) rotate(${turn}deg) scaleX(${crop.flip?-1:1}) translate(-50%,-50%)`,
          transition:animate?'transform .28s ease, width .28s ease, height .28s ease':'none',opacity:ready?1:0}} />}
      {!ready && <span className="photo-crop-loading">{error?'Preview unavailable':'Loading original…'}</span>}
      {ready && <div className="photo-crop-frame" style={{width:fw,height:fh,transition:animate?'width .28s ease, height .28s ease':'none'}}>
        <div className="photo-crop-grid" aria-hidden="true" />
        {target==='photo' && ([[-1,-1],[1,-1],[-1,1],[1,1]] as const).map(([sx,sy])=><span key={`${sx}${sy}`} className={`photo-crop-corner ${sy<0?'t':'b'}${sx<0?'l':'r'}`} aria-hidden="true" onPointerDown={e=>pointerDown(e,{sx,sy})} />)}
      </div>}
    </div>
    <div className="photo-crop-tools" role="toolbar" aria-label="Crop tools">
      <button type="button" disabled={!ready||busy} onClick={rotateLeft} title="Rotate 90° left"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4 3 8l4 4M3 8h11a6 6 0 0 1 0 12h-3" /></svg>Rotate</button>
      <button type="button" disabled={!ready||busy} onClick={flip} aria-pressed={!!crop.flip} title="Flip left to right"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M9 7 3 17h6zM15 7l6 10h-6z" /></svg>Flip</button>
      <button type="button" disabled={!ready||busy} onClick={resetAll}>Reset</button>
    </div>
    {target==='photo' && <div className="photo-crop-ratios" role="radiogroup" aria-label="Aspect ratio">
      {RATIOS.map(r=><button key={r.id} type="button" role="radio" aria-checked={ratio.id===r.id} disabled={!ready||busy} onClick={()=>chooseRatio(r.id,r.id==='original'?turnedAspect<1:ratio.portrait)}>{r.name}</button>)}
    </div>}
    {target==='photo' && canTurnRatio && <div className="photo-crop-orient" role="radiogroup" aria-label="Orientation">
      <button type="button" role="radio" aria-checked={ratio.portrait} aria-label="Portrait" title="Portrait" disabled={busy} onClick={()=>chooseRatio(ratio.id,true)}><span style={{width:11,height:16}} /></button>
      <button type="button" role="radio" aria-checked={!ratio.portrait} aria-label="Landscape" title="Landscape" disabled={busy} onClick={()=>chooseRatio(ratio.id,false)}><span style={{width:16,height:11}} /></button>
    </div>}
    <fieldset disabled={!ready||busy} className="photo-crop-fields">
      <label>Straighten · {(crop.straighten||0).toFixed(1)}°<input aria-label="Straighten angle" type="range" min="-45" max="45" step="0.1" value={crop.straighten||0} onChange={e=>setCrop(c=>({...c,straighten:Number(e.target.value)}))} onDoubleClick={()=>setCrop(c=>({...c,straighten:0}))}/></label>
      <label>Zoom · {crop.zoom.toFixed(2)}×<input aria-label="Crop zoom" type="range" min="1" max="5" step="0.01" value={crop.zoom} onChange={e=>setCrop(c=>({...c,zoom:Number(e.target.value)}))}/></label>
    </fieldset>
    <p className="photo-crop-help">Drag the photo to move it; pinch or scroll to zoom.{target==='photo'?' Drag a corner for a freeform crop.':''}</p>
    {target==='photo' && <small>Square gallery thumbnails may trim the edges; the enlarged photo uses the complete saved crop. A separate cover crop stays unchanged.</small>}
    {error && <p role="alert" className="photo-crop-error">{error}</p>}
    </div><div className="photo-crop-footer"><button type="button" className="btn-ghost" disabled={busy||!ready} onClick={()=>save(true)}>{target==='cover'?'Reset cover':'Restore original'}</button><button type="button" className="btn-ghost" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="btn" disabled={!ready||busy} onClick={()=>save()}>{busy?'Saving…':'Save crop'}</button></div>
  </dialog>;
}
