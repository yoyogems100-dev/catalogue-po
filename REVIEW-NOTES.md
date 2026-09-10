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

## Order workflow follow-up — 10 September 2026

Owner confirmed that Purchase remains the customer-facing action and the team confirms price and availability afterward. Catalogue submission now shows a persistent reference and Order placed (or Quotation requested), plus an explicit WhatsApp share link. My Orders shows the saved description, payment status and latest generated PDF.

Admin pricing now uses Save/Discard, validates optional values and reports write failures. Unsaved prices block PDF generation/sharing. WhatsApp previews include up to three latest customer-visible admin notes; the action still opens a draft for the admin to send, not a delivery receipt. PDF generation includes payment status, contact-name fallback and all public notes, excludes internal notes, and distinguishes a partial subtotal from a total.

Confirmed by source review: customer ownership-filtered history, admin creation, status/payment editing, item editing, and notes exist. Guest history requires the matching phone identity; without a phone/session an order is not attached to an account. Phone matching currently strips punctuation but does not reconcile local vs country-code formats. Admin creation currently chooses one Purchase/Quotation type for the entire order. Existing PDFs are order summaries/quotations, not invoices. Later changes require regenerating the PDF. Price batch writes and order creation are not transactional; database-backed idempotency and rollback remain follow-up work.

Validation: production build/TypeScript, six regression tests including synthetic mixed-price PDF generation, and visual review of the generated sample. No live orders, prices, notes, messages or status changes were made. Real end-to-end verification still requires a separate test database and an approved message recipient.
