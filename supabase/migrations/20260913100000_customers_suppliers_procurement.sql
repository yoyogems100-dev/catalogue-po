BEGIN;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS work_stream text,
  ADD COLUMN IF NOT EXISTS go_to_requirements text;

CREATE TABLE IF NOT EXISTS public.suppliers (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  contact_name text,
  phone text,
  email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplier_categories (
  supplier_id bigint NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  category_id bigint NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  notes text,
  PRIMARY KEY (supplier_id, category_id)
);

CREATE TABLE IF NOT EXISTS public.supplier_rates (
  id bigserial PRIMARY KEY,
  supplier_id bigint NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  category_id bigint NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  shape_id bigint REFERENCES public.shapes(id) ON DELETE SET NULL,
  shape_size_id bigint REFERENCES public.shape_sizes(id) ON DELETE SET NULL,
  color_id bigint REFERENCES public.colors(id) ON DELETE SET NULL,
  cost_price numeric(14,4) NOT NULL CHECK (cost_price >= 0),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency IN ('INR', 'RMB')),
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS supplier_id bigint REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_price numeric(14,4) CHECK (cost_price IS NULL OR cost_price >= 0),
  ADD COLUMN IF NOT EXISTS cost_currency text NOT NULL DEFAULT 'INR' CHECK (cost_currency IN ('INR', 'RMB'));

CREATE INDEX IF NOT EXISTS customers_name_idx ON public.customers(name);
CREATE INDEX IF NOT EXISTS suppliers_name_idx ON public.suppliers(name);
CREATE INDEX IF NOT EXISTS supplier_categories_category_idx ON public.supplier_categories(category_id);
CREATE INDEX IF NOT EXISTS supplier_rates_supplier_category_idx ON public.supplier_rates(supplier_id, category_id);
CREATE INDEX IF NOT EXISTS order_items_supplier_idx ON public.order_items(supplier_id);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_rates ENABLE ROW LEVEL SECURITY;

-- Supplier and procurement data is intentionally private. Admin server routes
-- use the service-role client, so no public read or write policies are added.

COMMIT;
