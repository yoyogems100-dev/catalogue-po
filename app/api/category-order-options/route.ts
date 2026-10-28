import {NextRequest,NextResponse} from 'next/server';
import {supabasePublic} from '@/lib/supabase-public';
import {specialCategory} from '@/lib/order-specs';
import {cachedCatalogue,SHARED_JSON_CACHE} from '@/lib/catalogue-cache';
// Cached like the rest of the catalogue; admin's editor asks with &fresh=1 so
// the CDN never hands it a copy from before its own save.
const loadCounts=cachedCatalogue(async(id:number)=>{
 const {data,error}=await supabasePublic.from('rainbow_strip_options').select('shape_size_id,allowed_counts').eq('category_id',id);
 if(error) throw error;
 return Object.fromEntries((data||[]).map(row=>[row.shape_size_id,row.allowed_counts]));
},['rainbow-strip-options']);
export async function GET(req:NextRequest) {
 const id=Number(req.nextUrl.searchParams.get('categoryId'));
 const headers={'Cache-Control':req.nextUrl.searchParams.has('fresh')?'no-store':SHARED_JSON_CACHE};
 if(!specialCategory(id)) return NextResponse.json({counts:{}},{headers});
 if(specialCategory(id)==='drilled') return NextResponse.json({counts:{}},{headers});
 const counts=await loadCounts(id).catch(()=>null);
 if(!counts) return NextResponse.json({error:'Strip options are not available yet.'},{status:503});
 return NextResponse.json({counts},{headers});
}
