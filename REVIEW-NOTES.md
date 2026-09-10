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

## Customer review and admin navigation — 10 September 2026

Implemented a modal review step before Purchase/Request quotation, with editable return, per-line type/quantity, contact/comment and price-confirmation copy. A client-side pending lock prevents repeated clicks during a request; it does not replace server idempotency.

Gallery filters group equivalent size labels while preserving every underlying ID and sort numeric dimensions. The photo viewer uses a native modal with explicit keyboard wrapping, Escape and focus restoration. Photo-to-cart skips shape/size mismatches and keeps purchase lines separate from quotations.

Admin orders now have customer/name/phone or order-number search, payment and India-time date filters, oldest/newest sorting, persistent filter URLs and mobile cards. Broad customer searches ask for refinement instead of silently dropping matches. Overview provides live confirmation/sourcing/dispatch/payment queues and recent orders, with unavailable states on query failure. Category editing has section navigation and persistent photo-save error feedback.

Remaining: isolated database setup and migration reconciliation; transactional/idempotent creation; full order, notification and import tests; individual admin accounts/roles and activity history; invoice business fields and generation; deeper photo/bulk management. Requests for local-vs-hosted test setup and invoice/team details are pending. No live data mutations or messages were sent.

This batch passes the production build/TypeScript and seven regression tests. Headless Chromium at 390px verified gallery size uniqueness, photo modal focus wrapping and Escape, adding a draft line, reviewing it and returning to edit. The submit endpoint was blocked during browser QA; no order was submitted. Admin search/dashboard and photo writes still require isolated data verification.

## Local tooling and business requirements — 10 September 2026

Installed development-only PGlite 0.5.8 within the owner's 5 GB cap: approximately 25 MB installed plus 8.4 MB npm cache growth. `npm run test:local-db` checks synthetic in-memory commits, constraints and rollback; it does not reproduce the live schema or test application writes. No Docker runtime was installed. Seven regression tests and the production build pass.

Recorded proprietor-provided invoice identity/address/contact in docs/BUSINESS-REQUIREMENTS.md. Tax/shipping rules and admin team permissions remain unset. Added /admin/content and its menu link as an entry point for existing catalogue, photo, header-logo and pricing controls; this is not a general page builder. No production settings were changed.

## Currency views, selected-first pickers and dashboard — 10 September 2026

Admin pricing has RMB and INR views. RMB retains supplier-price editing and the conversion multiplier; INR displays converted prices only. Both the INR view and exports use the saved multiplier, not an unsaved draft. Price-list PDFs always display INR-only amounts and omit supplier RMB prices and the rate. CSV follows the selected view. INR view is read-only; switching currencies does not rewrite prices. Invalid/missing conversion rates block INR PDF export. Price loading now cancels stale category requests and reports errors, and failed saves no longer change the converted-price state.

The combined shapes/sizes picker now places selected options first when opened (sizes when expanded), matching existing customer IconSelect and admin MultiSelect behavior. Ordering stays stable while selecting. Added a keyboard-accessible trigger, named controls, Escape and click-outside handling.

The /admin overview remains the login destination. Added today's orders (India time) and website-content shortcuts. Internal admin navigation now stays in the same tab.

Validation: production build/TypeScript and seven regression tests pass. Browser checks against synthetic component fixtures verify currency values/hidden multiplier, saved-rate behavior and selected-first order in all three picker types, with zero writes. PDF text extraction verifies INR 24 from RMB 2 × 12 and absence of RMB/rate text; the rendered page was visually reviewed. No live prices or catalogue links were modified. Changes remain on the review branch.

## Category workspaces and Glass Pearls — 10 September 2026

Added Overview / Shapes & sizes / Colors / Photos / Pricing / Specifications category tabs. Colors reuse the same master editor with the category fixed, show only its linked rows, provide a link picker and replace global delete with category-only unlink. Shared name/photo edits are labelled as shared. Pricing is fixed to the current category. Consolidated Colors and Shapes pages support category filtering; filtered Shapes shows category-linked size subsets and disables global reorder/delete controls. Tags supports category-filtered linked records. Pricing accepts a category query parameter.

Downloaded 24 exact supplier pearl thumbnails from the user-supplied Lustrella catalogue, matched to the names/codes in the owner's chart. Each PNG is 128×128; all 24 total 386,430 bytes. Source/product URLs are recorded in docs/glass-pearl-colors.json. Pearl swatches show the complete image at a minimum 28px, rather than the earlier highly zoomed color crop.

The reviewed data migration is pending, not applied to production: supabase/migrations/20260910190000_glass_pearl_colors.sql. It adds the 24 named/coded colors, associates their local assets and replaces only Glass Pearls category links. Existing colors/photo/order references and other-category links are retained. Release the data change together with the assets. New pearl color pricing-group assignments remain unconfigured; no prices or mappings were invented.

Validation: production build/TypeScript, seven regression tests, and the actual data migration applied twice in a disposable PostgreSQL fixture. Browser QA verifies distinct category tabs, fixed-category pricing, master color/shape filters and all 24 image downloads. No live mutation or message was sent. The user's final extra dropdown sentence was incomplete; clarification is pending.
