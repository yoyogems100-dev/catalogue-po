import {NextRequest,NextResponse} from 'next/server';
import {isAdminAuthed} from '@/lib/auth';
import {supabaseAdmin} from '@/lib/supabase-admin';
import {RAINBOW_CATEGORY_ID} from '@/lib/order-specs';
export async function PUT(req:NextRequest) {
 if(!(await isAdminAuthed())) return NextResponse.json({error:'Unauthorized'},{status:401});
 let body;try{body=await req.json();}catch{return NextResponse.json({error:'Invalid JSON'},{status:400});}
 const {sizeId,counts}=body||{};
 if(!Number.isSafeInteger(sizeId)||sizeId<1||!Array.isArray(counts)||counts.length>30||counts.some(n=>!Number.isInteger(n)||n<1||n>100000))return NextResponse.json({error:'Enter up to 30 positive whole stone counts.'},{status:400});
 const {data:linked,error:linkError}=await supabaseAdmin.from('category_shape_sizes').select('shape_size_id').eq('category_id',RAINBOW_CATEGORY_ID).eq('shape_size_id',sizeId).maybeSingle();
 if(linkError)return NextResponse.json({error:'Could not check category sizes.'},{status:503});
 if(!linked)return NextResponse.json({error:'Link this size to Rainbow Corundum first.'},{status:400});
 const {error}=await supabaseAdmin.from('rainbow_strip_options').upsert({category_id:RAINBOW_CATEGORY_ID,shape_size_id:sizeId,allowed_counts:[...new Set(counts)].sort((a:any,b:any)=>a-b)});
 if(error)return NextResponse.json({error:'Could not save strip counts.'},{status:503});
 return NextResponse.json({ok:true});
}
