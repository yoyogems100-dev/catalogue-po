import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionSecret } from '../lib/session-secret';
import { signAdminToken } from '../lib/auth';
import { signCustomerToken } from '../lib/customer-auth';
import { middleware } from '../middleware';
import { NextRequest } from 'next/server';

test('sessions require configured secrets and preserve separate admin/customer identities', async () => {
  const admin = process.env.ADMIN_SESSION_SECRET;
  const customer = process.env.CUSTOMER_SESSION_SECRET;
  try {
    delete process.env.ADMIN_SESSION_SECRET;
    delete process.env.CUSTOMER_SESSION_SECRET;
    assert.equal(sessionSecret('admin'), undefined);
    assert.equal(sessionSecret('customer'), undefined);
    assert.throws(() => signAdminToken());
    assert.throws(() => signCustomerToken(1));
    assert.equal((await middleware(new NextRequest('http://localhost/admin'))).status, 307);
    process.env.ADMIN_SESSION_SECRET = 'test-only-secret-not-used-by-any-deployment';
    assert.notEqual(sessionSecret('customer'), sessionSecret('admin'));
    const adminToken = signAdminToken();
    const customerToken = signCustomerToken(123);
    const request = (path: string, name: string, token: string) => new NextRequest(`http://localhost${path}`, { headers: { cookie: `${name}=${token}` } });
    assert.equal((await middleware(request('/admin/categories', 'yoyo_admin_session', adminToken))).status, 200);
    assert.equal((await middleware(request('/account/orders', 'yoyo_customer_session', customerToken))).status, 200);
    assert.equal((await middleware(request('/admin/categories', 'yoyo_admin_session', customerToken))).status, 307);
    assert.equal((await middleware(request('/account/orders', 'yoyo_customer_session', adminToken))).status, 307);
    assert.equal((await middleware(new NextRequest('http://localhost/account/login'))).status, 200);
  } finally {
    if (admin === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = admin;
    if (customer === undefined) delete process.env.CUSTOMER_SESSION_SECRET; else process.env.CUSTOMER_SESSION_SECRET = customer;
  }
});

test('React 19 renders both PDF templates in the server ESM runtime', async () => {
  const { buildSync } = await import('esbuild');
  const { execFileSync } = await import('node:child_process');
  const fs = await import('node:fs');
  const dir = fs.mkdtempSync('node_modules/.yoyo-pdf-test-');
  try {
    const output = `${dir}/check.mjs`;
    buildSync({ entryPoints: ['tests/pdf-fixture.tsx'], outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', tsconfig: 'tests/tsconfig.json' });
    execFileSync(process.execPath, [output], { stdio: 'pipe' });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
