import test from 'node:test';
import assert from 'node:assert/strict';
import { referencePhotos } from '../lib/order-reference-photos';
const photos = [
 {id:1,url:'/a.jpg',shapeIds:[1],colorIds:[2],sizeIds:[91]},
 {id:2,url:'/b.jpg',shapeIds:[3],colorIds:[4],sizeIds:[92]},
 {id:3,url:null,shapeIds:[1],colorIds:[2],sizeIds:[91]}
];
test('order references match all active option dimensions and ignore unavailable URLs',()=>{
 const result=referencePhotos(photos,{shapeIds:[1,3],colorIds:[2],sizeIds:[91]});
 assert.deepEqual(result.photos.map(photo=>photo.id),[1]);assert.equal(result.matching,true);assert.equal(result.fallback,false);
});
test('unmatched options retain category references with an explicit fallback',()=>{
 const result=referencePhotos(photos,{shapeIds:[1],colorIds:[4],sizeIds:[]});
 assert.deepEqual(result.photos.map(photo=>photo.id),[1,2]);assert.equal(result.matching,false);assert.equal(result.fallback,true);
 const empty=referencePhotos([],{shapeIds:[],colorIds:[],sizeIds:[]});assert.deepEqual(empty.photos,[]);
 const all=referencePhotos(photos,{shapeIds:[],colorIds:[],sizeIds:[]});assert.equal(all.matching,false);assert.equal(all.fallback,false);
});
