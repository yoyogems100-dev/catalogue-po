import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { cropRect, pixelCrop, validCrop } from '../lib/photo-crop';
import { photoUrl } from '../lib/photos';

test('portrait and landscape crops stay in bounds at every edge and preserve the chosen aspect',()=>{
 for(const [w,h] of [[4000,1000],[1000,4000],[401,599]])for(const aspect of [1,4/3,3/4])for(const zoom of [1,2,5])for(const x of [0,50,100])for(const y of [0,100]){
  const rect=cropRect(w/h,{x,y,zoom,aspect});const px=pixelCrop(w,h,{x,y,zoom,aspect});
  assert(Math.abs(rect.width*w/(rect.height*h)-aspect)<1e-8);
  assert(px.left>=0&&px.top>=0&&px.left+px.width<=w&&px.top+px.height<=h);
 }
 assert.equal(validCrop({x:50,y:50,zoom:0,aspect:1}),false);
 assert.equal(validCrop({x:Infinity,y:0,zoom:1,aspect:1}),false);
 assert.equal(validCrop({x:0,y:0,zoom:1,aspect:NaN}),false);
});
test('saved pixels match an edge preview without overwriting the original',async()=>{
 const data=Buffer.alloc(200*100*3);for(let y=0;y<100;y++)for(let x=0;x<200;x++){const i=(y*200+x)*3;data[i]=x<100?255:0;data[i+2]=x>=100?255:0;}
 const original=await sharp(data,{raw:{width:200,height:100,channels:3}}).png().toBuffer();const copy=Buffer.from(original);
 const result=await sharp(original).extract(pixelCrop(200,100,{x:100,y:50,zoom:1,aspect:1})).raw().toBuffer({resolveWithObject:true});
 assert.equal(result.info.width,100);assert.equal(result.info.height,100);
 assert.deepEqual([...result.data.slice(0,3)],[0,0,255]);assert.deepEqual(original,copy);
});
test('cover and product crop selection are independent, with original fallbacks',()=>{
 const settings={x:50,y:50,zoom:1,aspect:1};
 const photo={storage_path:'original.png',photo_crop:{...settings,path:'product.webp'},cover_crop:{...settings,path:'cover.webp'}};
 assert(photoUrl(photo)?.endsWith('/product.webp'));assert(photoUrl(photo,400,'cover')?.endsWith('/cover.webp'));
 assert(photoUrl({...photo,photo_crop:null},400,'cover')?.endsWith('/cover.webp'));
 assert(photoUrl({...photo,cover_crop:null},400,'cover')?.endsWith('/product.webp'));
 assert(photoUrl({storage_path:'original.png'})?.endsWith('/original.png'));
 assert.equal(photoUrl({drive_id:'example'},800),'https://lh3.googleusercontent.com/d/example=w800');
});
