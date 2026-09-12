import test from 'node:test';
import assert from 'node:assert/strict';
import {validSpecQuantity,specText,specKey} from '../lib/order-specs';
test('strip counts and drill choices keep order lines distinct',()=>{
 const a={kind:'rainbow' as const,colorMode:'custom' as const,stonesPerStrip:100,colors:[{id:4,name:'Blue'}]};
 assert(validSpecQuantity(a,200));assert(!validSpecQuantity(a,201));assert(!validSpecQuantity(a,0));
 assert(!validSpecQuantity(a,2147483700));assert(specText(a,200).includes('2 strips × 100'));
 assert.notEqual(specKey(a),specKey({...a,stonesPerStrip:56}));
 assert.notEqual(specKey({kind:'drilled',drill:'half'}),specKey({kind:'drilled',drill:'full'}));
});
test('category validation requires configured counts, canonical colors and explicit drill choice',async()=>{
 process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'synthetic-test-key';
 const {validateOrderSpecs}=await import('../lib/validate-order-specs');
 const rows:any={shape_sizes:[{id:10,shape_id:2}],category_shape_sizes:[{category_id:29,shape_size_id:10},{category_id:20,shape_size_id:10}],category_shapes:[{category_id:29,shape_id:2},{category_id:20,shape_id:2}],category_colors:[{category_id:29,color_id:4},{category_id:20,color_id:4}],colors:[{id:4,name:'Blue'}],rainbow_strip_options:[{category_id:29,shape_size_id:10,allowed_counts:[56,100]}]};
 const database={from(name:string){let data=rows[name];const q:any={select(){return q},eq(k:string,v:any){data=data.filter((r:any)=>r[k]===v);return q},in(k:string,v:any[]){data=data.filter((r:any)=>v.includes(r[k]));return q},maybeSingle(){return Promise.resolve({data:data[0]||null,error:null})},then(resolve:any){return Promise.resolve({data,error:null}).then(resolve)}};return q;}};
 const line:any={categoryId:29,shapeId:2,sizeId:10,colorId:null,qty:200,orderSpecs:{kind:'rainbow',colorMode:'custom',stonesPerStrip:100,colors:[{id:4,name:'Untrusted name'}]}};
 const [saved]=await validateOrderSpecs([line],database);assert.equal(saved.colorId,null);assert.equal(saved.orderSpecs.colors[0].name,'Blue');
 await assert.rejects(validateOrderSpecs([{...line,orderSpecs:undefined}],database));
 await assert.rejects(validateOrderSpecs([{...line,qty:150}],database));
 await assert.rejects(validateOrderSpecs([{...line,shapeId:3}],database));
 await assert.rejects(validateOrderSpecs([{...line,qty:144,orderSpecs:{...line.orderSpecs,stonesPerStrip:72}}],database));
 const drilled={...line,categoryId:20,colorId:4,qty:5,orderSpecs:{kind:'drilled',drill:'full'}};
 assert.equal((await validateOrderSpecs([drilled],database))[0].orderSpecs.drill,'full');
 await assert.rejects(validateOrderSpecs([{...drilled,orderSpecs:{kind:'drilled',drill:'other'}}],database));
});
