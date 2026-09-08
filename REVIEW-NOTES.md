# First improvement pass — 8 September 2026

The live catalogue has 40 categories, beyond the older 32-category handoff. Existing customer order history already includes repeat-order controls. The first pass uses those existing capabilities and adds focused improvements rather than replacing trade data or rebuilding the app.

## Completed in this branch

Framework/dependency maintenance, admin authorization checks, safe session defaults, production sign-in fallback handling, mobile quantity editing and estimates, catalogue completeness filters, quotation filters and pricing-follow-up indicators. See DEVELOPMENT.md for tests and rollout implications.

## Follow-up work

1. Establish a separate test database/environment before exercising order creation, edits, uploads, deletions and real authentication delivery end-to-end. The current Vercel preview uses the production database.
2. Add proper email delivery before re-enabling email sign-in. Verify WhatsApp delivery and OTP completion with a user-approved test recipient.
3. Review guest order submission for transactional writes, idempotency and prevention of duplicate submissions. Verify failure recovery before expanding the sales workflow.
4. Improve photo tagging and bulk import failure handling. Completeness filters now identify the categories to review; new trade defaults still require business confirmation.
5. Design quotation follow-up dates, ownership and acceptance status with the owner. Those features need explicit workflow definitions and potentially a database migration; current filters require none.
6. Reconcile the older MIGRATIONS.md with applied Supabase migrations before any schema change. Do not execute the stale bootstrap SQL.
7. Confirm whether the natural-stone categories are intentional before revising brand messaging or category descriptions.

## Review limits

The local catalogue/admin list reads and request guards were checked. Real account sign-in delivery, customer history with real credentials, admin writes, and order submission were not exercised against the live database. Tests render synthetic order/PDF data without uploading it or messaging anyone.
