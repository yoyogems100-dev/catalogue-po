'use client';
import {useEffect,useState} from 'react';
import IconSelect from './IconSelect';
import {specialCategory,specText,validSpecQuantity,type OrderSpecs} from '@/lib/order-specs';
type Ref={id:number;name:string;hex?:string|null;iconKey?:string|null;refPhotoUrl?:string|null};
export type SpecialLine={id:string;categoryId:number;categoryName:string;shapeId:number;shapeName:string;sizeId:number;colorId:number|null;colorName:string;colorHex:string;sizeMm:string;qty:number;requestType:'Place Order'|'Request Quotation';orderSpecs:OrderSpecs};
export default function SpecialOrderComposer({categoryId,categoryName,shapes,colors,sizes,onAdd,showRequestType=true}:{categoryId:number;categoryName:string;shapes:Ref[];colors:Ref[];sizes:{id:number;shapeId:number;sizeMm:string}[];onAdd:(line:SpecialLine)=>void;showRequestType?:boolean}) {
 const kind=specialCategory(categoryId);
 const [shapeId,setShape]=useState<number|'all'>('all'),[sizeId,setSize]=useState<number|'all'>('all');
 const [colorIds,setColors]=useState<number[]>([]),[mode,setMode]=useState<'default'|'custom'>('default');
 const [drill,setDrill]=useState<'half'|'full'|''>('');
 const [count,setCount]=useState<number|'all'>('all'),[quantity,setQuantity]=useState('');
 const [requestType,setRequestType]=useState<'Place Order'|'Request Quotation'>('Place Order');
 const [counts,setCounts]=useState<Record<number,number[]>>({}),[error,setError]=useState(''),[ready,setReady]=useState(kind==='drilled');
 useEffect(()=>{let active=true;if(kind==='rainbow'){fetch(`/api/category-order-options?categoryId=${categoryId}`,{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Strip options are not configured yet. Please contact the team.');return r.json();}).then(data=>{if(active){setCounts(data.counts);setReady(true);}}).catch(e=>{if(active)setError(e.message);});}return()=>{active=false;};},[categoryId,kind]);
 const shape=shapes.find(s=>s.id===shapeId),size=sizes.find(s=>s.id===sizeId);
 const allowed=typeof sizeId==='number'?(counts[sizeId]||[]):[];
 const units=Number(quantity),qty=kind==='rainbow'?units*Number(count):units;
 const spec:OrderSpecs=kind==='rainbow'?{kind:'rainbow',colorMode:mode,stonesPerStrip:Number(count),colors:mode==='custom'?colors.filter(c=>colorIds.includes(c.id)).map(c=>({id:c.id,name:c.name})).sort((a,b)=>a.id-b.id):[]}:{kind:'drilled',drill:drill||'half'};
 const valid=ready&&shape&&size&&size.shapeId===shape.id&&/^\d+$/.test(quantity)&&units>0&&validSpecQuantity(spec,qty)&&(kind==='rainbow'?allowed.includes(Number(count))&&(mode==='default'||(colorIds.length>0&&colorIds.length<=Number(count))):!!drill&&colorIds.length===1);
 function add(){if(!valid||!shape||!size)return;const color=colors.find(c=>c.id===colorIds[0]);onAdd({id:crypto.randomUUID(),categoryId,categoryName,shapeId:shape.id,shapeName:shape.name,sizeId:size.id,sizeMm:size.sizeMm,colorId:kind==='rainbow'?null:color!.id,colorName:kind==='rainbow'?(mode==='default'?'Default colors':spec.kind==='rainbow'?spec.colors.map(c=>c.name).join(', '):''):color!.name,colorHex:color?.hex||'#ccc',qty,requestType,orderSpecs:spec});setQuantity('');setError('Added to order.');}
 return <div className="special-order-composer">
  {kind==='rainbow'?<><fieldset><legend>Strip colors</legend><label><input type="radio" checked={mode==='default'} onChange={()=>setMode('default')}/> Default color</label><label><input type="radio" checked={mode==='custom'} onChange={()=>setMode('custom')}/> Custom colors</label></fieldset>{mode==='custom'&&<><IconSelect multiple options={colors} values={colorIds} onChange={setColors} leading="swatch" placeholder="Choose custom strip colors"/><p className="po-reference-hint">These colors form one strip request. The team will confirm the arrangement.</p></>}</>:<fieldset><legend>Drilling</legend><label><input type="radio" checked={drill==='half'} onChange={()=>setDrill('half')}/> Half drill</label><label><input type="radio" checked={drill==='full'} onChange={()=>setDrill('full')}/> Full drill</label></fieldset>}
  <div className="po-add-form">
   <div><label className="po-label">Shape</label><IconSelect options={shapes} value={shapeId} onChange={id=>{setShape(id);setSize('all');setCount('all');}} leading="icon" allLabel="Choose shape"/></div>
   <div><label className="po-label">Size (mm)</label><IconSelect optionKind="size" options={sizes.filter(s=>s.shapeId===shapeId).map(s=>({id:s.id,name:s.sizeMm+' mm'}))} value={sizeId} onChange={id=>{setSize(id);setCount('all');}} allLabel="Choose size"/></div>
   {kind==='rainbow'?<div><label className="po-label">Stones per strip</label><select aria-label="Stones per strip" value={count} onChange={e=>setCount(e.target.value==='all'?'all':Number(e.target.value))}><option value="all">{sizeId==='all'?'Choose size first':allowed.length?'Choose stone count':'No strip counts configured'}</option>{allowed.map(n=><option key={n} value={n}>{n} stones / strip</option>)}</select></div>:<div><label className="po-label">Color</label><IconSelect options={colors} value={colorIds[0]??'all'} onChange={id=>setColors(id==='all'?[]:[id])} leading="swatch" allLabel="Choose color"/></div>}
   <div><label className="po-label">{kind==='rainbow'?'Number of strips':'Quantity (pcs)'}</label><input aria-label={kind==='rainbow'?'Number of strips':'Drilled stone quantity'} inputMode="numeric" value={quantity} onChange={e=>setQuantity(e.target.value.replace(/\D/g,''))}/></div>
  </div>
  <div hidden={!showRequestType} className="po-type-toggle" role="group" aria-label="Special order request type"><button type="button" className={requestType==='Place Order'?'active':''} aria-pressed={requestType==='Place Order'} onClick={()=>setRequestType('Place Order')}>Purchase</button><button type="button" className={requestType==='Request Quotation'?'active':''} aria-pressed={requestType==='Request Quotation'} onClick={()=>setRequestType('Request Quotation')}>Request Quotation</button></div>
  {valid&&<p role="status">{specText(spec,qty)} · {qty.toLocaleString('en-IN')} stones total</p>}
  <button type="button" className="po-add-line-btn" disabled={!valid} onClick={add}>+ Add line to order</button>
  {error&&<p role="status">{error}</p>}
 </div>;
}
