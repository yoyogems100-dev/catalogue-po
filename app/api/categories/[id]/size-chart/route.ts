import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { supabasePublic } from '@/lib/supabase-public';
import SizeChartDocument, { type SizeChartSection } from '@/lib/pdf/SizeChartDocument';
export const runtime='nodejs';
function compareDimensions(a:string,b:string){
 const left=a.split('x').map(Number),right=b.split('x').map(Number);
 for(let i=0;i<Math.max(left.length,right.length);i++){const delta=(left[i]||0)-(right[i]||0);if(delta)return delta;}
 return 0;
}
export async function GET(_req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const id=Number((await params).id);
 if(id!==34)return NextResponse.json({error:'Size chart unavailable for this category.'},{status:404});
 const [category,shapes,sizes]=await Promise.all([
  supabasePublic.from('categories').select('name').eq('id',id).single(),
  supabasePublic.from('category_shapes').select('shape_id,ref_photo_url,shapes(name)').eq('category_id',id),
  supabasePublic.from('category_shape_sizes').select('diamond_equivalent_ct,shape_sizes(shape_id,size_mm)').eq('category_id',id)
 ]);
 if(category.error||shapes.error||sizes.error)return NextResponse.json({error:'Could not load the size chart. Please retry.'},{status:503});
 const sections:SizeChartSection[]=await Promise.all((shapes.data||[]).map(async(s:any)=>{
  let image:string|null=null;
  if(/^\/moissanite-shapes\/[a-z-]+\.png$/.test(s.ref_photo_url||'')){
   try{image='data:image/png;base64,'+(await readFile(path.join(process.cwd(),'public',s.ref_photo_url))).toString('base64');}catch{}
  }
  return {name:s.shapes.name,image,rows:(sizes.data||[]).filter((r:any)=>r.shape_sizes?.shape_id===s.shape_id).map((r:any)=>({size:r.shape_sizes.size_mm,diamondEquivalentCt:r.diamond_equivalent_ct===null?null:Number(r.diamond_equivalent_ct)})).sort((a,b)=>compareDimensions(a.size,b.size))};
 }));
 sections.sort((a,b)=>a.name==='Round'?-1:b.name==='Round'?1:a.name.localeCompare(b.name));
 if(!sections.some(s=>s.rows.length))return NextResponse.json({error:'No sizes configured yet.'},{status:404});
 const buffer=await renderToBuffer(React.createElement(SizeChartDocument,{sections,categoryName:category.data.name}) as any);
 return new NextResponse(new Uint8Array(buffer),{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="YOYO-GEMS-Moissanite-Shapes-Sizes.pdf"','Cache-Control':'public, max-age=60'}});
}
