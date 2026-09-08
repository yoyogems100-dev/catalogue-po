// Edge-safe: share the same configuration between middleware and server routes.
export function sessionSecret(kind: 'admin' | 'customer'): string | undefined {
  if (kind === 'admin') return process.env.ADMIN_SESSION_SECRET || undefined;
  return process.env.CUSTOMER_SESSION_SECRET ||
    (process.env.ADMIN_SESSION_SECRET ? `customer:${process.env.ADMIN_SESSION_SECRET}` : undefined);
}
