import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
try {
 await db.exec("CREATE TABLE photos(id bigint primary key,storage_path text); INSERT INTO photos VALUES(1,'original.png');");
 const sql=readFileSync('supabase/migrations/20260912090000_photo_crops.sql','utf8');await db.exec(sql);await db.exec(sql);
 await db.query('UPDATE photos SET photo_crop=$1,cover_crop=$2 WHERE id=1',[JSON.stringify({path:'photo.webp'}),JSON.stringify({path:'cover.webp'})]);
 await db.exec('UPDATE photos SET photo_crop=NULL WHERE id=1');
 assert.deepEqual((await db.query('SELECT * FROM photos')).rows[0],{id:1,storage_path:'original.png',photo_crop:null,cover_crop:{path:'cover.webp'}});
 console.log('PASS: repeatable migration; reset keeps original and independent cover crop.');
}finally{await db.close();}
