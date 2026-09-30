import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// Runs the customer-passwords migration twice against a minimal customers
// table with Supabase's default grants to anon, then checks the new tables
// exist, cascade with their customer, and are unreadable to anon.
const db = new PGlite();
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE public.customers(id bigserial primary key, phone text unique);
    INSERT INTO public.customers(phone) VALUES ('9000000001'), ('9000000002');
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
    GRANT USAGE ON SCHEMA public TO anon, authenticated;`);

  const sql = readFileSync('supabase/migrations/20261004090000_customer_passwords.sql', 'utf8');
  await db.exec(sql);
  await db.exec(sql); // repeat-safe

  await db.exec(`INSERT INTO customer_credentials(customer_id, password_hash, set_by) VALUES (1, 'scrypt$x', 'admin')`);
  await db.exec(`INSERT INTO customer_login_failures(phone, ip_hash) VALUES ('9000000001', 'abc')`);
  await assert.rejects(db.exec(`INSERT INTO customer_credentials(customer_id, password_hash, set_by) VALUES (2, 'x', 'someone')`), 'set_by is checked');

  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    await assert.rejects(db.query(`SELECT * FROM customer_credentials`), `${role} cannot read passwords`);
    await assert.rejects(db.query(`SELECT * FROM customer_login_failures`), `${role} cannot read login failures`);
    await assert.rejects(db.exec(`INSERT INTO customer_credentials(customer_id, password_hash) VALUES (2, 'x')`), `${role} cannot write passwords`);
    await db.exec(`RESET ROLE`);
  }

  await db.exec(`DELETE FROM customers WHERE id = 1`);
  assert.equal(Number((await db.query(`SELECT count(*) n FROM customer_credentials`)).rows[0].n), 0, 'credentials go with their customer');
  console.log('customer_passwords migration: ok');
} finally {
  await db.close();
}
