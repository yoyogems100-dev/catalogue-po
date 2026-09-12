# Development and review

Use Node.js 24.x (`.nvmrc` pins the local version). Install with `npm ci`, then run `npm test` and `npm run build`. Run `npm run dev -- --hostname 127.0.0.1` for a local preview.

The application uses Next.js 16.3.4, React 19.2.8, Supabase JS 2.116.0, and React PDF 4.9.0. Webpack is explicitly retained. The Edge middleware convention is still supported but deprecated; it is intentionally retained to preserve the existing Web Crypto runtime.

## Environment

Copy `.env.example` to `.env.local` and configure the appropriate environment. Never commit credentials. Both admin and customer session verification now fail closed without configured secrets. If `CUSTOMER_SESSION_SECRET` is absent, a separate customer signing secret is derived from `ADMIN_SESSION_SECRET`. Existing customer sessions signed with the former default must sign in again. Admin sessions using the configured secret remain valid.

The prepared local Mac preview uses the public anon key for both Supabase clients. This permits catalogue review under public RLS policies, but it is not a full admin or order-writing environment. Local admin page checks use randomly generated local credentials. No production admin password or service-role key is stored in that preview.

Email delivery is not integrated. Email sign-in is therefore unavailable in production. Development-only token display requires both `NODE_ENV=development` and `ALLOW_DEV_AUTH_CODES=true`, and should only be used with isolated test data. WhatsApp failures return a retryable error instead of revealing codes. No real notifications should be sent during smoke tests without the user's explicit instruction.

Vercel preview and production environments currently point at the same Supabase project. Treat a hosted preview as connected to live data: browse it without creating test orders, editing records, deleting photos, or sending notifications. Full mutation tests require isolated test data/environment first.

## What changed

- Updated async cookies, headers, route parameters and search parameters for the current framework.
- Added server-side login checks to administrative catalogue handlers and admin layout.
- Removed fixed session-secret fallbacks and production authentication-code disclosure.
- Made mobile quantities replaceable, widened controls, added accessible names, and showed quantity-per-line totals before adding.
- Prevented saved lines from another category from using the currently viewed category's prices. Partial estimates are labelled as subtotals.
- Added catalogue completeness filters and clearer failed category-save feedback.
- Added quotation/purchase filters, unpriced quotation-line indicators, and 50-request pagination to admin orders. Mixed requests appear in both type filters.

## Verification

- `npm test`: session configuration and role separation; both PDF templates in the server ESM runtime; whole-piece quantity validation; category-specific cart pricing; missing-content filters; production restrictions on development sign-in codes.
- `npm run build`: production compilation and TypeScript checks.
- `npm audit --omit=dev`: zero reported production dependency advisories at verification time (not a full security audit).
- Local HTTP checks: public catalogue and category pages; redirects for protected pages; rejection of unauthenticated admin writes; invalid guest quantities; authenticated local category/order views.
- Mobile browser check at 390px: selection, draft persistence across reopening, replacing a 5,000-piece quantity with 12,500, updated totals, and readable controls. No requirement was submitted.

No database migrations or reference-data replacements are part of these changes.


## Lightweight local database runtime

`npm run test:local-db` starts disposable PGlite PostgreSQL entirely in memory and checks transaction commits, constraints and rollback. It uses synthetic tables/data, reads no credentials and does not contact Supabase. Closing the process discards the database. This is development-only; it adds no hosted runtime dependency.

This is not a replica of the live schema, a full Supabase stack, or end-to-end coverage. Auth, storage, notification delivery and application write flows still require an isolated integration environment and reconciled migrations. The owner capped new local database tooling at 5 GB; Docker/Supabase was not installed.
