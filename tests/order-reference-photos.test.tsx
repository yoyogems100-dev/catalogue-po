import test from 'node:test';
import assert from 'node:assert/strict';
import { referencePhotos } from '../lib/order-reference-photos';
const photos = [
 {id:1,url:'/a.jpg',shapeIds:[1],colorIds:[2],sizeIds:[91]},
 {id:2,url:'/b.jpg',shapeIds:[3],colorIds:[4],sizeIds:[92]},
 {id:3,url:null,shapeIds:[1],colorIds:[2],sizeIds:[91]}
];
test('picking options re-orders the reference strip instead of emptying it',()=>{
 // The strip used to filter down to matching photos, so its contents changed
 // out from under the buyer on every pick -- and a shape with no tagged photo
 // fell back to showing the entire gallery. Now every photo stays put and the
 // matches simply come first, best match leading.
 const result=referencePhotos(photos,{shapeIds:[1,3],colorIds:[2],sizeIds:[91]});
 // Photo 1 matches shape, colour and size; photo 2 only the shape.
 assert.deepEqual(result.photos.map(photo=>photo.id),[1,2]);
 assert.equal(result.matching,true);assert.equal(result.fallback,false);
 // A photo with no usable URL is still left out -- there is nothing to show.
 assert.equal(result.photos.some(photo=>photo.id===3),false);
});
test('a partial match still leads, and a total miss says so',()=>{
 // Shape 1 and colour 4 sit on different photos: each matches one dimension,
 // so neither outranks the other and the admin's own order decides.
 const partial=referencePhotos(photos,{shapeIds:[1],colorIds:[4],sizeIds:[]});
 assert.deepEqual(partial.photos.map(photo=>photo.id),[1,2]);
 assert.equal(partial.matching,true);assert.equal(partial.fallback,false);
 // Nothing carries this shape: the photos are still shown, flagged as a
 // fallback so the strip can say they are not matched to the selection.
 const miss=referencePhotos(photos,{shapeIds:[99],colorIds:[],sizeIds:[]});
 assert.deepEqual(miss.photos.map(photo=>photo.id),[1,2]);
 assert.equal(miss.matching,false);assert.equal(miss.fallback,true);
 const empty=referencePhotos([],{shapeIds:[],colorIds:[],sizeIds:[]});assert.deepEqual(empty.photos,[]);
 const all=referencePhotos(photos,{shapeIds:[],colorIds:[],sizeIds:[]});
 assert.deepEqual(all.photos.map(photo=>photo.id),[1,2]);
 assert.equal(all.matching,false);assert.equal(all.fallback,false);
});
test('the purchase composer shows one tile per stone, not every angle of it',()=>{
 // Extra angles belong to the Explore Photos gallery, where they can be
 // swiped through. Here they would just repeat the same stone across the
 // strip and push the next stone off screen.
 const grouped=[...photos,{id:4,url:'/a-side.jpg',parentId:1,shapeIds:[1],colorIds:[2],sizeIds:[91]}];
 const result=referencePhotos(grouped,{shapeIds:[1],colorIds:[],sizeIds:[]});
 assert.deepEqual(result.photos.map(photo=>photo.id),[1,2]);
});
