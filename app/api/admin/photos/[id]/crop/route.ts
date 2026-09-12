import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { revalidatePath } from 'next/cache';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase-admin';
import { validCrop, pixelCrop } from '@/lib/photo-crop';

export const runtime = 'nodejs';
const MAX_BYTES=20*1024*1024;
type Context={params:Promise<{id:string}>};
async function getPhoto(context:Context) {
  const id=Number((await context.params).id);
  if(!Number.isSafeInteger(id)||id<1) throw new Error('Invalid photo.');
  const {data,error}=await supabaseAdmin.from('photos').select('*').eq('id',id).single();
  if(error||!data) throw new Error('Photo could not be loaded.');
  return data;
}
async function original(photo:any) {
  let bytes:Buffer;
  if(photo.storage_path) {
    const {data,error}=await supabaseAdmin.storage.from(PHOTOS_BUCKET).download(photo.storage_path);
    if(error||!data) throw new Error('Original image could not be loaded.');
    if(data.size>MAX_BYTES) throw new Error('Use an original smaller than 20 MB.');
    bytes=Buffer.from(await data.arrayBuffer());
  } else if(typeof photo.drive_id==='string' && /^[A-Za-z0-9_-]+$/.test(photo.drive_id)) {
    const response=await fetch(`https://lh3.googleusercontent.com/d/${photo.drive_id}=w2400`,{signal:AbortSignal.timeout(15000),redirect:'error',cache:'no-store'});
    if(!response.ok||!response.body) throw new Error('Drive image unavailable. Check sharing or upload the image directly.');
    const chunks:Uint8Array[]=[];let total=0;const reader=response.body.getReader();
    try {while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>MAX_BYTES)throw new Error('Use an original smaller than 20 MB.');chunks.push(value);}} finally {await reader.cancel();}
    bytes=Buffer.concat(chunks);
  } else throw new Error('No original image is available.');
  return sharp(bytes,{limitInputPixels:40000000}).rotate().toBuffer({resolveWithObject:true});
}
export async function GET(_req:NextRequest,context:Context) {
  if(!await isAdminAuthed())return NextResponse.json({error:'Unauthorized'},{status:401});
  try {
    const photo=await getPhoto(context);
    // Fail visibly before editing if deployment has not installed the migration.
    if(!('photo_crop' in photo))return NextResponse.json({error:'Crop setup is pending. Please complete the photo-crop database migration.'},{status:503});
    const source=await original(photo);
    const preview=await sharp(source.data).resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).png().toBuffer();
    return new NextResponse(new Uint8Array(preview),{headers:{'Content-Type':'image/png','Cache-Control':'private, no-store'}});
  } catch {return NextResponse.json({error:'Original image could not be loaded. Check the source image or upload it directly.'},{status:400});}
}
export async function POST(req:NextRequest,context:Context) {
  if(!await isAdminAuthed())return NextResponse.json({error:'Unauthorized'},{status:401});
  let uploaded:string|undefined;
  try {
    const {target,crop,reset}=await req.json();
    if(!['photo','cover'].includes(target)|| (reset!==true && !validCrop(crop)))return NextResponse.json({error:'Choose a valid crop.'},{status:400});
    const photo=await getPhoto(context);
    if(!('photo_crop' in photo))return NextResponse.json({error:'Crop setup is pending. Please complete the photo-crop database migration.'},{status:503});
    const column=target==='cover'?'cover_crop':'photo_crop';
    let saved=null;
    if(reset!==true){
      const source=await original(photo);
      const output=await sharp(source.data).extract(pixelCrop(source.info.width,source.info.height,crop)).resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:90}).toBuffer();
      uploaded=`${photo.category_id}/crops/${photo.id}-${target}-${randomUUID()}.webp`;
      const {error}=await supabaseAdmin.storage.from(PHOTOS_BUCKET).upload(uploaded,output,{contentType:'image/webp',upsert:false});
      if(error)throw new Error('Could not save the cropped image. Please retry.');
      saved={x:crop.x,y:crop.y,zoom:crop.zoom,aspect:crop.aspect,path:uploaded};
    }
    const {data,error}=await supabaseAdmin.from('photos').update({[column]:saved}).eq('id',photo.id).select('id').single();
    if(error||!data)throw new Error('Could not save the crop. The previous image is unchanged.');
    // Keep previous derivatives for cached pages; originals are never overwritten.
    uploaded=undefined;
    revalidatePath('/','layout');
    return NextResponse.json({ok:true,crop:saved});
  } catch {
    if(uploaded)await supabaseAdmin.storage.from(PHOTOS_BUCKET).remove([uploaded]);
    return NextResponse.json({error:'Could not save the crop. Check the source image and connection, then retry.'},{status:400});
  }
}
