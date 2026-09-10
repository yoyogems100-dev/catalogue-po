import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

// Disposable, in-memory database. No .env files, Supabase clients or network calls.
// This verifies the test runtime, not the application's production schema/workflow.
const db = new PGlite();
try {
  await db.exec(`
    CREATE TABLE test_orders (id integer PRIMARY KEY, description text);
    CREATE TABLE test_lines (
      order_id integer REFERENCES test_orders(id),
      quantity integer NOT NULL CHECK (quantity > 0)
    );
  `);
  await db.transaction(async tx => {
    await tx.query('INSERT INTO test_orders VALUES ($1, $2)', [1, 'Synthetic test order']);
    await tx.query('INSERT INTO test_lines VALUES ($1, $2)', [1, 100]);
  });
  assert.equal((await db.query('SELECT quantity FROM test_lines')).rows[0].quantity, 100);
  await assert.rejects(db.transaction(async tx => {
    await tx.query('INSERT INTO test_orders VALUES ($1, $2)', [2, 'Must roll back']);
    await tx.query('INSERT INTO test_lines VALUES ($1, $2)', [2, -1]);
  }));
  assert.equal((await db.query('SELECT count(*)::int AS count FROM test_orders')).rows[0].count, 1);
  console.log('Local PostgreSQL test runtime ready: transaction commit, constraints and rollback verified.');
  console.log('Disposable synthetic data only. The live site and Supabase were not contacted.');
  console.log('This is a database test runtime, not full Supabase Auth/Storage or application end-to-end coverage.');
} finally {
  await db.close();
}
