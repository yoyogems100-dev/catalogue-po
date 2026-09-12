'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cropRect, DEFAULT_CROP, type CropSettings, type SavedCrop } from '@/lib/photo-crop';

export default function PhotoCropEditor({photoId,photoCrop,coverCrop,coverOnly=false}:{photoId:number;photoCrop?:SavedCrop|null;coverCrop?:SavedCrop|null;coverOnly?:boolean}) {
  const [target,setTarget]=useState<'photo'|'cover'|null>(null);
  const [message,setMessage]=useState('');const router=useRouter();
  return <div className="photo-crop-actions">
    {!coverOnly && <button type="button" className="btn-ghost" onClick={()=>setTarget('photo')}>Crop photo</button>}
    <button type="button" className="btn-ghost" onClick={()=>setTarget('cover')}>Adjust cover</button>
    {message && <small role="status">{message}</small>}
    {target && <CropDialog photoId={photoId} target={target} initial={(target==='cover'?coverCrop:photoCrop)||DEFAULT_CROP} onClose={()=>setTarget(null)} onSaved={reset=>{setMessage(reset?(target==='cover'?'Cover reset to photo crop / original.':'Original photo restored.'):'Crop saved.');setTarget(null);router.refresh();}} />}
  </div>;
}
function CropDialog({photoId,target,initial,onClose,onSaved}:{photoId:number;target:'photo'|'cover';initial:CropSettings;onClose:()=>void;onSaved:(reset:boolean)=>void}) {
  const [crop,setCrop]=useState<CropSettings>({...initial,aspect:target==='cover'?1:initial.aspect});
  const [source,setSource]=useState('');const [sourceAspect,setSourceAspect]=useState(1);const [ready,setReady]=useState(false);
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);const frame=useRef<HTMLDivElement>(null);
  const drag=useRef<{id:number;x:number;y:number;crop:CropSettings}|null>(null);
  useEffect(()=>{dialog.current?.showModal();},[]);
  useEffect(()=>{
    const controller=new AbortController();let url='';
    (async()=>{try {const response=await fetch(`/api/admin/photos/${photoId}/crop`,{signal:controller.signal});
      if(!response.ok){const data=await response.json();throw new Error(data.error||'Could not load the original.');}
      url=URL.createObjectURL(await response.blob());setSource(url);
    }catch(err){if(!controller.signal.aborted)setError(err instanceof Error?err.message:'Could not load the original.');}})();
    return()=>{controller.abort();if(url)URL.revokeObjectURL(url);};
  },[photoId]);
  const rect=cropRect(sourceAspect,crop);
  const clamp=(n:number)=>Math.max(0,Math.min(100,n));
  function setValue(key:keyof CropSettings,value:number){setCrop(current=>({...current,[key]:value}));}
  async function save(reset=false){
    setBusy(true);setError('');
    try {const response=await fetch(`/api/admin/photos/${photoId}/crop`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target,crop,reset})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Save failed.');onSaved(reset);}
    catch(err){setError(err instanceof Error?err.message:'Could not save. Please retry.');}finally{setBusy(false);}
  }
  return <dialog ref={dialog} className="photo-crop-dialog" aria-labelledby="photo-crop-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <div className="photo-crop-head"><h2 id="photo-crop-title">{target==='cover'?'Adjust category cover':'Crop product photo'}</h2><button autoFocus type="button" aria-label="Close crop editor" disabled={busy} onClick={onClose}>×</button></div>
    <div className="photo-crop-body"><p>{target==='cover'?'Preview the square image used on category cards. This does not change the Explore photo.':'Adjust the photo used in Explore and order references. The original is kept for future edits.'}</p>
    <div className="photo-crop-stage"><div ref={frame} className="photo-crop-frame" style={{aspectRatio:crop.aspect,maxWidth:crop.aspect<1?300*crop.aspect:320}} aria-label="Crop preview" onPointerDown={e=>{if(!ready||busy)return;frame.current?.setPointerCapture(e.pointerId);drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,crop};}}
      onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}
      onPointerMove={e=>{const start=drag.current;if(!start||start.id!==e.pointerId||!frame.current)return;const bounds=frame.current.getBoundingClientRect();const r=cropRect(sourceAspect,start.crop);setCrop({...start.crop,x:r.width<1?clamp(start.crop.x-(e.clientX-start.x)/bounds.width*r.width/(1-r.width)*100):50,y:r.height<1?clamp(start.crop.y-(e.clientY-start.y)/bounds.height*r.height/(1-r.height)*100):50});}}>
      {source && <img draggable={false} src={source} alt="Original image with crop preview" onLoad={e=>{setSourceAspect(e.currentTarget.naturalWidth/e.currentTarget.naturalHeight);setReady(true);}} onError={()=>{setReady(false);setError('The original image could not be displayed.');}} style={{position:'absolute',width:`${100/rect.width}%`,height:`${100/rect.height}%`,maxWidth:'none',left:`${-100*rect.x/rect.width}%`,top:`${-100*rect.y/rect.height}%`,opacity:ready?1:0}} />}
      {!ready && <span>{error?'Preview unavailable':'Loading original…'}</span>}
      {ready && <div className="photo-crop-grid" aria-hidden="true" />}
    </div></div>
    <p className="photo-crop-help">Drag to reposition, or use the sliders below.</p>
    <fieldset disabled={!ready||busy} className="photo-crop-fields">
      {target==='photo' && <label>Crop shape<select aria-label="Crop shape" value={crop.aspect} onChange={e=>setCrop({...DEFAULT_CROP,aspect:Number(e.target.value)})}>
        {[{name:'Square',value:1},{name:'Landscape (4:3)',value:4/3},{name:'Portrait (3:4)',value:3/4},{name:'Original proportions',value:sourceAspect}].filter((o,i,all)=>all.findIndex(v=>Math.abs(v.value-o.value)<0.0001)===i).map(o=><option key={o.value} value={o.value}>{o.name}</option>)}
      </select></label>}
      <label>Zoom · {crop.zoom.toFixed(2)}×<input aria-label="Crop zoom" type="range" min="1" max="5" step="0.01" value={crop.zoom} onChange={e=>setValue('zoom',Number(e.target.value))}/></label>
      <label>Horizontal position<input aria-label="Horizontal crop position" type="range" min="0" max="100" step="0.1" disabled={rect.width>=1} value={crop.x} onChange={e=>setValue('x',Number(e.target.value))}/></label>
      <label>Vertical position<input aria-label="Vertical crop position" type="range" min="0" max="100" step="0.1" disabled={rect.height>=1} value={crop.y} onChange={e=>setValue('y',Number(e.target.value))}/></label>
      <button type="button" className="btn-ghost" onClick={()=>setCrop({...DEFAULT_CROP,aspect:crop.aspect})}>Reset adjustments</button>
    </fieldset>
    {target==='photo' && <small>Square gallery thumbnails may trim the edges; the enlarged photo uses the complete saved crop. A separate cover crop stays unchanged.</small>}
    {error && <p role="alert" className="photo-crop-error">{error}</p>}
    </div><div className="photo-crop-footer"><button type="button" className="btn-ghost" disabled={busy||!ready} onClick={()=>save(true)}>{target==='cover'?'Reset cover':'Restore original'}</button><button type="button" className="btn-ghost" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="btn" disabled={!ready||busy} onClick={()=>save()}>{busy?'Saving…':'Save crop'}</button></div>
  </dialog>;
}
