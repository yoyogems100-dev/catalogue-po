import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { cropGeometry, cropRect, pixelCrop, validCrop } from '../lib/photo-crop';
import { croppedOriginal } from '../lib/photo-files';
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
test('rotated and straightened crop boxes never leave the photo, and plain crops are unchanged',()=>{
 for(const [w,h] of [[4000,1000],[1000,4000],[600,600]])for(const rotate of [0,90,180,270])for(const straighten of [-45,-12.5,0,30])for(const aspect of [0.3,1,16/9])for(const zoom of [1,2.5])for(const x of [0,50,100])for(const y of [0,100]){
  const g=cropGeometry(w,h,{x,y,zoom,aspect,rotate,straighten});
  const c=Math.cos(g.angle),s=Math.sin(g.angle);
  for(const [px,py] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
   // Output corner turned back into the photo's axes.
   const ox=px*g.bw/2,oy=py*g.bh/2;const ix=g.cx+ox*c+oy*s,iy=g.cy-ox*s+oy*c;
   assert(Math.abs(ix)<=g.W/2+1e-6&&Math.abs(iy)<=g.H/2+1e-6,`${w}x${h} r${rotate} s${straighten} a${aspect}`);
  }
  assert(Math.abs(g.bw/g.bh-aspect)<1e-9);
 }
 const g=cropGeometry(4000,1000,{x:30,y:50,zoom:2,aspect:1});const r=cropRect(4,{x:30,y:50,zoom:2,aspect:1});
 assert(Math.abs((g.W/2+g.cx-g.bw/2)/g.W-r.x)<1e-9&&Math.abs(g.bw/g.W-r.width)<1e-9);
 assert.equal(validCrop({x:50,y:50,zoom:1,aspect:1,rotate:45}),false);
 assert.equal(validCrop({x:50,y:50,zoom:1,aspect:1,straighten:60}),false);
 assert.equal(validCrop({x:50,y:50,zoom:1,aspect:1,rotate:270,straighten:-12,flip:true}),true);
});
test('saved rotation, flip and straighten come out as previewed with no blank corners',async()=>{
 const data=Buffer.alloc(200*100*3);for(let y=0;y<100;y++)for(let x=0;x<200;x++){const i=(y*200+x)*3;data[i]=x<100?255:0;data[i+2]=x>=100?255:0;}
 const png=await sharp(data,{raw:{width:200,height:100,channels:3}}).png().toBuffer();const upright={data:png,info:{width:200,height:100}};
 const pixel=async(buf:Buffer,x:number,y:number)=>{const r=await sharp(buf).raw().toBuffer({resolveWithObject:true});const i=(y*r.info.width+x)*r.info.channels;return {rgb:[...r.data.slice(i,i+3)],w:r.info.width,h:r.info.height};};
 // A quarter turn clockwise puts the red left half on top.
 let p=await pixel(await croppedOriginal(upright,{x:50,y:0,zoom:1,aspect:1,rotate:90}),50,50);
 assert.deepEqual([p.w,p.h],[100,100]);assert.deepEqual(p.rgb,[255,0,0]);
 p=await pixel(await croppedOriginal(upright,{x:50,y:0,zoom:1,aspect:1,rotate:90,flip:true}),50,50);assert.deepEqual(p.rgb,[0,0,255]);
 const tilted=await croppedOriginal(upright,{x:50,y:50,zoom:1,aspect:1,straighten:10});
 for(const [x,y] of [[1,1],[-2,1],[1,-2],[-2,-2]]){const m=await sharp(tilted).metadata();const q=await pixel(tilted,(x+m.width!)%m.width!,(y+m.height!)%m.height!);assert.notDeepEqual(q.rgb,[255,255,255]);}
});
