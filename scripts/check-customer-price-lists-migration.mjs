import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
try {
  await db.exec('CREATE TABLE categories(id int primary key); INSERT INTO categories VALUES (1), (2);');
  const sql = readFileSync('supabase/migrations/20261021130000_customer_price_lists.sql', 'utf8');
  await db.exec(sql);
  await db.exec(sql); // repeat-safe
  await db.exec(`INSERT INTO customer_price_lists (category_id, customer_name, prices) VALUES (1, 'Sharma Jewellers', '[{"s":1,"g":2,"p":17}]')`);
  await assert.rejects(db.exec(`INSERT INTO customer_price_lists (category_id, customer_name) VALUES (1, ' sharma jewellers ')`), /unique/);
  await db.exec(`INSERT INTO customer_price_lists (category_id, customer_name) VALUES (2, 'Sharma Jewellers')`); // other category is fine
  await assert.rejects(db.exec(`INSERT INTO customer_price_lists (category_id, customer_name) VALUES (1, '   ')`), /check/);
  await assert.rejects(db.exec(`INSERT INTO customer_price_lists (category_id, customer_name, prices) VALUES (1, 'X', '{}')`), /check/);
  const row = (await db.query("SELECT price_date = current_date AS today, prices->0->>'p' AS p FROM customer_price_lists WHERE customer_name = 'Sharma Jewellers' AND category_id = 1")).rows[0];
  assert.deepEqual(row, { today: true, p: '17' });
  await db.exec('DELETE FROM categories WHERE id = 2');
  assert.equal(Number((await db.query('SELECT count(*) n FROM customer_price_lists')).rows[0].n), 1);
  console.log('PASS: repeatable; one list per customer name per category; names/prices validated; cascades with the category.');
} finally { await db.close(); }
