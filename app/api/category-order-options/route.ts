import {NextRequest,NextResponse} from 'next/server';
import {supabasePublic} from '@/lib/supabase-public';
import {specialCategory} from '@/lib/order-specs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest) {
 const id=Number(req.nextUrl.searchParams.get('categoryId'));
 if(!specialCategory(id)) return NextResponse.json({counts:{}});
 if(specialCategory(id)==='drilled') return NextResponse.json({counts:{}});
 const {data,error}=await supabasePublic.from('rainbow_strip_options').select('shape_size_id,allowed_counts').eq('category_id',id);
 if(error) return NextResponse.json({error:'Strip options are not available yet.'},{status:503});
 return NextResponse.json({counts:Object.fromEntries((data||[]).map(row=>[row.shape_size_id,row.allowed_counts]))},{headers:{'Cache-Control':'no-store'}});
}
