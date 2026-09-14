import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { supabasePublic } from '@/lib/supabase-public';
import { getCategoryPricing } from '@/lib/pricing';
import { lineInrPrice } from '@/lib/pricing-calc';
import SizeChartDocument, { type SizeChartColor, type SizeChartSection } from '@/lib/pdf/SizeChartDocument';
import { getPdfLogoDataUrl } from '@/lib/pdf/brand';
export const runtime='nodejs';
function compareDimensions(a:string,b:string){
 const left=a.split('x').map(Number),right=b.split('x').map(Number);
 for(let i=0;i<Math.max(left.length,right.length);i++){const delta=(left[i]||0)-(right[i]||0);if(delta)return delta;}
 return 0;
}
async function imageDataUrl(source:string|null|undefined){
 if(!source)return null;
 try{
  if(source.startsWith('/')){
   const publicRoot=path.resolve(process.cwd(),'public');
   const filePath=path.resolve(publicRoot,source.slice(1));
   if(!filePath.startsWith(publicRoot+path.sep))return null;
   const extension=path.extname(filePath).toLowerCase();
   const original=await readFile(filePath);
   if(extension==='.webp')return `data:image/png;base64,${(await sharp(original).png().toBuffer()).toString('base64')}`;
   const mime=extension==='.jpg'||extension==='.jpeg'?'image/jpeg':'image/png';
   return `data:${mime};base64,${original.toString('base64')}`;
  }
  if(/^https?:\/\//.test(source)){
   const response=await fetch(source);
   if(!response.ok)return null;
   const original=Buffer.from(await response.arrayBuffer());
   const mime=response.headers.get('content-type')||'image/jpeg';
   if(mime.includes('webp'))return `data:image/png;base64,${(await sharp(original).png().toBuffer()).toString('base64')}`;
   return `data:${mime};base64,${original.toString('base64')}`;
  }
 }catch{}
 return null;
}
export async function GET(_req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const id=Number((await params).id);
 const includePrices=_req.nextUrl.searchParams.get('type')==='prices'&&id===34;
 const [category,shapes,sizes,colorLinks]=await Promise.all([
  supabasePublic.from('categories').select('name').eq('id',id).single(),
  supabasePublic.from('category_shapes').select('shape_id,ref_photo_url,shapes(name,ref_photo_url)').eq('category_id',id),
  supabasePublic.from('category_shape_sizes').select('diamond_equivalent_ct,shape_sizes(id,shape_id,size_mm)').eq('category_id',id),
  supabasePublic.from('category_colors').select('color_id,colors(name,hex_value,ref_photo_url)').eq('category_id',id)
 ]);
 if(category.error||shapes.error||sizes.error||colorLinks.error)return NextResponse.json({error:'Could not load the size chart. Please retry.'},{status:503});
 // Every size row shares one price group, so a price-list export only makes
 // sense while exactly one color is linked (Moissanite's White/DEF today) --
 // silently picking "the first" color the moment a second one is ever added
 // would price every size off an arbitrary, undisclosed color with no
 // indication in the PDF of which one it was.
 if(includePrices&&(colorLinks.data?.length||0)!==1)return NextResponse.json({error:'Price list export requires exactly one linked color.'},{status:409});
 const pricing=includePrices?await getCategoryPricing(id):null;
 const colorId=colorLinks.data?.[0]?.color_id;
 const colors:SizeChartColor[]=await Promise.all((colorLinks.data||[]).map(async(row:any)=>{
  const color=Array.isArray(row.colors)?row.colors[0]:row.colors;
  return {name:color?.name||`Color #${row.color_id}`,hex:color?.hex_value||null,image:await imageDataUrl(color?.ref_photo_url)};
 }));
 colors.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
 const sections:SizeChartSection[]=await Promise.all((shapes.data||[]).map(async(s:any)=>{
  const shape=Array.isArray(s.shapes)?s.shapes[0]:s.shapes;
  const image=await imageDataUrl(s.ref_photo_url||shape?.ref_photo_url);
  return {name:shape?.name||`Shape #${s.shape_id}`,image,rows:(sizes.data||[]).filter((r:any)=>r.shape_sizes?.shape_id===s.shape_id).map((r:any)=>({size:r.shape_sizes.size_mm,diamondEquivalentCt:r.diamond_equivalent_ct===null?null:Number(r.diamond_equivalent_ct),...(includePrices?{priceInr:pricing&&colorId?lineInrPrice(pricing,s.shape_id,r.shape_sizes.id,colorId):null}:{})})).sort((a,b)=>compareDimensions(a.size,b.size))};
 }));
 sections.sort((a,b)=>a.name==='Round'?-1:b.name==='Round'?1:a.name.localeCompare(b.name));
 if(!sections.some(s=>s.rows.length))return NextResponse.json({error:'No sizes configured yet.'},{status:404});
 const buffer=await renderToBuffer(React.createElement(SizeChartDocument,{sections,colors,categoryName:category.data.name,includePrices,logoUrl:await getPdfLogoDataUrl()}) as any);
 const categorySlug=category.data.name.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'');
 return new NextResponse(new Uint8Array(buffer),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="YOYO-GEMS-${categorySlug}-${includePrices?'Price-List':'Shapes-Sizes'}.pdf"`,'Cache-Control':'public, max-age=60'}});
}
