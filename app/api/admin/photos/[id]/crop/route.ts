import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { revalidatePath } from 'next/cache';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase-admin';
import { validCrop } from '@/lib/photo-crop';
import { loadOriginalBytes, uploadWatermarked, uprightOriginal, watermarkedVariant } from '@/lib/photo-files';

export const runtime = 'nodejs';
type Context={params:Promise<{id:string}>};
async function getPhoto(context:Context) {
  const id=Number((await context.params).id);
  if(!Number.isSafeInteger(id)||id<1) throw new Error('Invalid photo.');
  const {data,error}=await supabaseAdmin.from('photos').select('*').eq('id',id).single();
  if(error||!data) throw new Error('Photo could not be loaded.');
  return data;
}
// Always the clean original -- never the watermarked copy the site shows --
// so the crop preview is unmarked and the saved crop carries one mark only.
async function original(photo:any) {
  return uprightOriginal(await loadOriginalBytes(supabaseAdmin,photo));
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
      uploaded=await uploadWatermarked(supabaseAdmin,photo,await watermarkedVariant(source,crop),target==='cover'?'crop-cover':'crop-photo');
      saved={x:crop.x,y:crop.y,zoom:crop.zoom,aspect:crop.aspect,rotate:crop.rotate||0,straighten:crop.straighten||0,flip:crop.flip===true,path:uploaded};
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
