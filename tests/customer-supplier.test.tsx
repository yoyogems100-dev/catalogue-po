import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import POSelector from '../components/POSelector';

test('the category builder no longer carries the requirement or its contact fields', () => {
  // Submitting moved to /cart, so the builder is only a builder: no contact
  // fields, no send button, and no second copy of the requirement panel.
  const props = { categoryId: 1, categoryName: 'Test', shapes: [], colors: [], sizes: [], active: false };
  for (const loggedIn of [false, true]) {
    const markup = renderToStaticMarkup(<POSelector {...props} loggedIn={loggedIn} />);
    assert.doesNotMatch(markup, /Name \/ company/);
    assert.doesNotMatch(markup, /WhatsApp number/);
    assert.doesNotMatch(markup, /Send requirement/);
    assert.doesNotMatch(markup, /po-cart-card/);
  }
});

test('procurement migration links customers, suppliers, categories, rates and order lines', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE customers(id bigint primary key, name text);
      CREATE TABLE categories(id bigint primary key, name text);
      CREATE TABLE shapes(id bigint primary key, name text);
      CREATE TABLE shape_sizes(id bigint primary key, shape_id bigint references shapes(id));
      CREATE TABLE colors(id bigint primary key, name text);
      CREATE TABLE order_items(id bigint primary key);
      INSERT INTO customers VALUES(1,'Buyer'); INSERT INTO categories VALUES(1,'Moissanite');
      INSERT INTO shapes VALUES(1,'Round'); INSERT INTO shape_sizes VALUES(1,1); INSERT INTO colors VALUES(1,'White'); INSERT INTO order_items VALUES(1);
    `);
    const sql = readFileSync('supabase/migrations/20260913100000_customers_suppliers_procurement.sql', 'utf8');
    await db.exec(sql); await db.exec(sql);
    await db.exec(`
      UPDATE customers SET work_stream='Silver jewellery', go_to_requirements='Round white stones' WHERE id=1;
      INSERT INTO suppliers(name) VALUES('Yinzheng');
      INSERT INTO supplier_categories VALUES(1,1,NULL);
      INSERT INTO supplier_rates(supplier_id,category_id,shape_id,shape_size_id,color_id,cost_price,currency) VALUES(1,1,1,1,1,25,'RMB');
      UPDATE order_items SET supplier_id=1,cost_price=25,cost_currency='RMB' WHERE id=1;
    `);
    assert.equal((await db.query<{ work_stream: string }>('SELECT work_stream FROM customers WHERE id=1')).rows[0].work_stream, 'Silver jewellery');
    assert.equal((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM supplier_rates')).rows[0].count, 1);
    assert.equal((await db.query<{ supplier_id: number }>('SELECT supplier_id FROM order_items WHERE id=1')).rows[0].supplier_id, 1);
  } finally { await db.close(); }
});
