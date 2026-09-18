-- Separate "Generate invoice" PDF (customer-price-only, SP-based totals) needs
-- its own stored link distinct from the existing order-summary/quotation pdf_url.
alter table orders add column if not exists invoice_url text;
