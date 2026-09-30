import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import chart from '../data/moissanite-chart.json';


test('Moissanite import replaces only its links and retains other categories and historic master sizes',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`CREATE TABLE categories(id int primary key,slug text);INSERT INTO categories VALUES(34,'moissanite'),(1,'other');
  CREATE TABLE shapes(id serial primary key,name text);CREATE TABLE shape_sizes(id serial primary key,shape_id int,size_mm text);
  CREATE TABLE colors(id serial primary key,name text,hex_value text);
  CREATE TABLE category_shapes(category_id int,shape_id int,primary key(category_id,shape_id));
  CREATE TABLE category_shape_sizes(category_id int,shape_size_id int,primary key(category_id,shape_size_id));
  CREATE TABLE category_colors(category_id int,color_id int);CREATE TABLE shape_size_prices(category_id int,price_rmb numeric);
  INSERT INTO shape_sizes(shape_id,size_mm) VALUES(1,'old-size');INSERT INTO category_shape_sizes VALUES(1,1),(34,1);
  INSERT INTO shape_size_prices VALUES(1,99),(34,50);`);
  for(const s of chart)await db.query('INSERT INTO shapes(name) VALUES($1)',[s.name]);
  const sql=readFileSync('supabase/migrations/20260912140000_moissanite_reference_options.sql','utf8');await db.exec(sql);await db.exec(sql);
  assert.equal((await db.query('SELECT * FROM category_shapes WHERE category_id=34')).rows.length,15);
  assert.equal((await db.query('SELECT * FROM category_shape_sizes WHERE category_id=34')).rows.length,271);
  assert.equal((await db.query('SELECT * FROM category_colors WHERE category_id=34')).rows.length,1);
  assert.equal((await db.query('SELECT * FROM shape_size_prices WHERE category_id=34')).rows.length,0);
  assert.equal((await db.query('SELECT * FROM shape_size_prices WHERE category_id=1')).rows.length,1);
  assert.equal((await db.query('SELECT * FROM category_shape_sizes WHERE category_id=1 AND shape_size_id=1')).rows.length,1);
  assert.equal((await db.query("SELECT * FROM shape_sizes WHERE size_mm='old-size'")).rows.length,1);
 }finally{await db.close();}
});
test('supplier-sheet sizes are added once, Tapered Baguette mirrors Trapezoid, and existing links are kept',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`CREATE TABLE categories(id int primary key,slug text);INSERT INTO categories VALUES(34,'moissanite'),(1,'other');
  CREATE TABLE shapes(id serial primary key,name text);CREATE TABLE shape_sizes(id serial primary key,shape_id int,size_mm text);
  CREATE TABLE category_shapes(category_id int,shape_id int,ref_photo_url text,reference_style text default 'vector',primary key(category_id,shape_id));
  CREATE TABLE category_shape_sizes(category_id int,shape_size_id int,diamond_equivalent_ct numeric,primary key(category_id,shape_size_id));`);
  for(const name of [...chart.map(s=>s.name),'Tapered Baguette'])await db.query('INSERT INTO shapes(name) VALUES($1)',[name]);
  await db.exec(`INSERT INTO shapes(name) VALUES('Heart');
  INSERT INTO category_shapes(category_id,shape_id) SELECT DISTINCT ON (name) 34,id FROM shapes ORDER BY name,id;
  INSERT INTO shape_sizes(shape_id,size_mm) SELECT id,'2x1.5x1' FROM shapes WHERE name='Trapezoid';
  INSERT INTO shape_sizes(shape_id,size_mm) SELECT id,'2.25' FROM shapes WHERE name='Round';
  INSERT INTO category_shape_sizes VALUES(34,1,0.06),(1,2,NULL);`);
  const sql=readFileSync('supabase/migrations/20261005090000_moissanite_excel_sizes.sql','utf8');await db.exec(sql);await db.exec(sql);
  const count=async(q:string)=>Number((await db.query<{n:number}>(`SELECT count(*)::int n FROM ${q}`)).rows[0].n);
  // 1 pre-existing Trapezoid link + 93 sheet sizes + 13 Trapezoid sizes copied to Tapered Baguette.
  assert.equal(await count('category_shape_sizes WHERE category_id=34'),1+93+13);
  assert.equal(await count("category_shape_sizes css JOIN shape_sizes z ON z.id=css.shape_size_id JOIN shapes s ON s.id=z.shape_id WHERE css.category_id=34 AND s.name='Tapered Baguette'"),13);
  assert.equal(await count("shape_sizes z JOIN shapes s ON s.id=z.shape_id WHERE s.name='Round' AND z.size_mm='2.25'"),1);
  assert.equal(await count('category_shape_sizes WHERE category_id=1'),1);
  // A second, unlinked master shape with the same name gets nothing.
  assert.equal(await count("shape_sizes z JOIN shapes s ON s.id=z.shape_id WHERE s.name='Heart' AND s.id=(SELECT max(id) FROM shapes WHERE name='Heart')"),0);
  const tb=await db.query<{ref_photo_url:string,reference_style:string}>("SELECT ref_photo_url,reference_style FROM category_shapes cs JOIN shapes s ON s.id=cs.shape_id WHERE s.name='Tapered Baguette'");
  assert.deepEqual(tb.rows[0],{ref_photo_url:'/moissanite-shapes/trapezoid.png',reference_style:'photo'});
  const dew=await db.query<{d:string}>("SELECT css.diamond_equivalent_ct::text d FROM category_shape_sizes css JOIN shape_sizes z ON z.id=css.shape_size_id JOIN shapes s ON s.id=z.shape_id WHERE s.name='Tapered Baguette' AND z.size_mm='2x1.5x1'");
  assert.equal(dew.rows[0].d,'0.06');
 }finally{await db.close();}
});
test('confirmed final Moissanite rows and all supplied reference images are included',()=>{
 for(const [name,size,ct] of [['Trillion','11x11',5],['Princess','12x12',10],['Baguette','3x6',0.65]] as const){const rows=chart.find(s=>s.name===name)!.rows;assert.deepEqual(rows.at(-1),{size,diamondEquivalentCt:ct});}
 for(const s of chart){assert(readFileSync(`public${s.image}`).length>100);assert.equal(new Set(s.rows.map(r=>r.size)).size,s.rows.length);}
});
test('new Moissanite requirements reject retired colors and unlinked sizes',async()=>{
 process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'synthetic-test-key';
 const {validateOrderSpecs}=await import('../lib/validate-order-specs');
 const db={from(table:string){const filters:Record<string,number>={};const query={select(){return query},eq(key:string,value:number){filters[key]=value;return query},async maybeSingle(){const data=table==='shape_sizes'?{shape_id:1}:table==='category_colors'?(filters.color_id===9?{color_id:9}:null):table==='category_shape_sizes'?(filters.shape_size_id===2?{shape_size_id:2}:null):{shape_id:1};return {data,error:null}}};return query;}};
 const line={categoryId:34,shapeId:1,sizeId:2,colorId:9,qty:10};
 assert.equal((await validateOrderSpecs([line],db)).length,1);
 await assert.rejects(()=>validateOrderSpecs([{...line,colorId:8}],db),/White \(DEF\)/);
 await assert.rejects(()=>validateOrderSpecs([{...line,sizeId:999}],db),/options have changed/);
});
