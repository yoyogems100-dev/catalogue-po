import {supabaseAdmin} from './supabase-admin';
import {specialCategory,validSpecQuantity,type OrderSpecs} from './order-specs';
// Canonicalize only the two scoped category configurations before any order writes.
export async function validateOrderSpecs<T extends {categoryId:number;shapeId:number;sizeId:number|null;colorId:number|null;qty:number;orderSpecs?:OrderSpecs|null}>(items:T[], database:any=supabaseAdmin):Promise<T[]> {
 const result:T[]=[];
 for(const item of items) {
  if(!item || ![item.categoryId,item.shapeId].every(n=>Number.isSafeInteger(n)&&n>0) || (item.sizeId!==null && (!Number.isSafeInteger(item.sizeId)||item.sizeId<=0)))throw Error('Choose valid category, shape and size options.');
  const kind=specialCategory(item.categoryId);
  if(!validSpecQuantity(item.orderSpecs,item.qty))throw Error('Use whole quantities; rainbow quantities must be complete strips.');
  if(!kind) {if(item.orderSpecs)throw Error('Extra specifications are not supported for this category.');result.push(item);continue;}
  const spec=item.orderSpecs;
  if(!spec||spec.kind!==kind)throw Error('Choose the strip or drill options for this category before submitting.');
  const [size,link,shapeLink]=await Promise.all([
   database.from('shape_sizes').select('id,shape_id').eq('id',item.sizeId).maybeSingle(),
   database.from('category_shape_sizes').select('shape_size_id').eq('category_id',item.categoryId).eq('shape_size_id',item.sizeId).maybeSingle(),
   database.from('category_shapes').select('shape_id').eq('category_id',item.categoryId).eq('shape_id',item.shapeId).maybeSingle()
  ]);
  if(size.error||link.error||shapeLink.error)throw Error('Could not validate category options. Please retry.');
  if(!size.data||size.data.shape_id!==item.shapeId||!link.data||!shapeLink.data)throw Error('Choose a linked shape and size.');
  if(spec.kind==='drilled') {
   if(!['half','full'].includes(spec.drill))throw Error('Choose Half drill or Full drill.');
   const color=await database.from('category_colors').select('color_id').eq('category_id',item.categoryId).eq('color_id',item.colorId).maybeSingle();
   if(color.error||!color.data)throw Error('Choose a linked color.');
   result.push({...item,orderSpecs:{kind:'drilled',drill:spec.drill}});continue;
  }
  if(!['default','custom'].includes(spec.colorMode))throw Error('Choose Default color or Custom colors.');
  const rules=await database.from('rainbow_strip_options').select('allowed_counts').eq('category_id',item.categoryId).eq('shape_size_id',item.sizeId).maybeSingle();
  if(rules.error||!rules.data?.allowed_counts.includes(spec.stonesPerStrip))throw Error('This stone count is not offered for the selected shape and size.');
  let colors:{id:number;name:string}[]=[];
  if(spec.colorMode==='custom') {
   if(!Array.isArray(spec.colors)||spec.colors.length<1||spec.colors.length>spec.stonesPerStrip||spec.colors.length>100)throw Error('Choose custom colors for this strip.');
   const ids=[...new Set(spec.colors.map(c=>c.id))].sort((a,b)=>a-b);
   const [linked,master]=await Promise.all([database.from('category_colors').select('color_id').eq('category_id',item.categoryId).in('color_id',ids),database.from('colors').select('id,name').in('id',ids)]);
   if(linked.error||master.error||linked.data?.length!==ids.length||master.data?.length!==ids.length)throw Error('Choose only colors linked to Rainbow Corundum.');
   colors=ids.map(id=>master.data!.find(c=>c.id===id)!);
  }
  result.push({...item,colorId:null,orderSpecs:{kind:'rainbow',colorMode:spec.colorMode,stonesPerStrip:spec.stonesPerStrip,colors}});
 }
 return result;
}
