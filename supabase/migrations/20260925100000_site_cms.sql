-- Public marketing website + its CMS.
--
-- Everything here is new and additive: no existing catalogue table is altered,
-- and nothing the /po catalogue or the mobile app reads changes. The website
-- has its own category tree (site_categories) that *points at* catalogue
-- categories through site_category_sources, so shapes, colours, sizes and
-- photos are reused from the catalogue instead of being entered twice.
--
-- Editable content is held as `draft` (what the admin is working on, autosaved)
-- and `published` (what the public site renders). Anonymous visitors can read
-- `published` only -- column grants below keep drafts and lead data private.

BEGIN;

-- Page content: one row per page (home, about, quality, ...), plus 'global'
-- for site-wide settings (contact details, SEO defaults, footer links).
CREATE TABLE IF NOT EXISTS public.site_pages (
  key          text PRIMARY KEY CHECK (key ~ '^[a-z0-9_-]+$'),
  draft        jsonb NOT NULL DEFAULT '{}'::jsonb,
  published    jsonb,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

-- Quality grades (A, 3A, 5A, 7A, High Density Swiss ...).
CREATE TABLE IF NOT EXISTS public.site_grades (
  id          serial PRIMARY KEY,
  code        text NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9-]+$'),
  name        text NOT NULL,
  summary     text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',   -- sanitised rich text
  sort_order  integer NOT NULL DEFAULT 0,
  is_visible  boolean NOT NULL DEFAULT true
);

-- Website category tree. Two levels only: parent_id is null for a top-level
-- category, and a child may not itself have children (enforced by trigger).
CREATE TABLE IF NOT EXISTS public.site_categories (
  id            serial PRIMARY KEY,
  parent_id     integer REFERENCES public.site_categories(id) ON DELETE RESTRICT,
  slug          text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name          text NOT NULL,
  descriptor    text NOT NULL DEFAULT '',   -- short line for tiles and menus
  sort_order    integer NOT NULL DEFAULT 0,
  is_visible    boolean NOT NULL DEFAULT true,
  -- Which filters appear on the page. Grade only where it applies.
  filters       jsonb NOT NULL DEFAULT '{"shape":true,"size":true,"colour":true,"grade":false}'::jsonb,
  hero_media_id integer,
  draft         jsonb NOT NULL DEFAULT '{}'::jsonb,   -- promise + 8 content blocks + SEO
  published     jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz,
  CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE UNIQUE INDEX IF NOT EXISTS site_categories_top_slug ON public.site_categories (slug) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS site_categories_child_slug ON public.site_categories (parent_id, slug) WHERE parent_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.site_categories_two_levels() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.site_categories WHERE id = NEW.parent_id AND parent_id IS NOT NULL) THEN
      RAISE EXCEPTION 'A sub-category cannot contain further sub-categories';
    END IF;
    IF EXISTS (SELECT 1 FROM public.site_categories WHERE parent_id = NEW.id) THEN
      RAISE EXCEPTION 'A category with sub-categories cannot be moved under another category';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS site_categories_two_levels ON public.site_categories;
CREATE TRIGGER site_categories_two_levels BEFORE INSERT OR UPDATE OF parent_id ON public.site_categories
  FOR EACH ROW EXECUTE FUNCTION public.site_categories_two_levels();

-- Which catalogue categories feed a website category. Optional grade marks
-- "stones from this catalogue category are grade X" (e.g. 5A Quality CZ -> 5A),
-- which is what powers the grade filter. Optional color_ids narrows a source
-- to some of its colours (e.g. a "Lab Emerald" page from Lab Grown Stones).
CREATE TABLE IF NOT EXISTS public.site_category_sources (
  site_category_id integer NOT NULL REFERENCES public.site_categories(id) ON DELETE CASCADE,
  category_id      integer NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  grade_id         integer REFERENCES public.site_grades(id) ON DELETE SET NULL,
  color_ids        integer[],
  sort_order       integer NOT NULL DEFAULT 0,
  PRIMARY KEY (site_category_id, category_id)
);

CREATE TABLE IF NOT EXISTS public.site_category_grades (
  site_category_id integer NOT NULL REFERENCES public.site_categories(id) ON DELETE CASCADE,
  grade_id         integer NOT NULL REFERENCES public.site_grades(id) ON DELETE CASCADE,
  PRIMARY KEY (site_category_id, grade_id)
);

-- Media library for website imagery (catalogue photos stay in `photos`).
CREATE TABLE IF NOT EXISTS public.site_media (
  id           serial PRIMARY KEY,
  storage_path text NOT NULL,              -- original, in the `photos` bucket under site/
  variants     jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {"480": "site/..-480.webp", ...}
  width        integer,
  height       integer,
  alt          text NOT NULL DEFAULT '',
  tags         text[] NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE public.site_categories ADD CONSTRAINT site_categories_hero_media_fkey
    FOREIGN KEY (hero_media_id) REFERENCES public.site_media(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Assign media to a category gallery, a colour, a shape or a size, in order.
CREATE TABLE IF NOT EXISTS public.site_media_links (
  media_id    integer NOT NULL REFERENCES public.site_media(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('site_category', 'color', 'shape', 'size')),
  target_id   integer NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (media_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS site_media_links_target ON public.site_media_links (target_type, target_id, sort_order);

CREATE TABLE IF NOT EXISTS public.site_faqs (
  id         serial PRIMARY KEY,
  question   text NOT NULL,
  answer     text NOT NULL DEFAULT '',     -- sanitised rich text
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true
);

-- Text history for undo: a snapshot is written on every publish and on
-- autosaves that change content, pruned by the app.
CREATE TABLE IF NOT EXISTS public.site_revisions (
  id         bigserial PRIMARY KEY,
  entity     text NOT NULL,     -- 'page' | 'category' | 'grade' | 'faq'
  entity_key text NOT NULL,     -- page key or row id
  content    jsonb NOT NULL,
  kind       text NOT NULL DEFAULT 'draft' CHECK (kind IN ('draft', 'publish')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_revisions_entity ON public.site_revisions (entity, entity_key, created_at DESC);

-- Catalogue requests from the public form.
CREATE TABLE IF NOT EXISTS public.site_leads (
  id                  bigserial PRIMARY KEY,
  name                text NOT NULL,
  business_city       text NOT NULL,
  whatsapp            text NOT NULL,
  category_ids        integer[] NOT NULL DEFAULT '{}',
  category_names      text[] NOT NULL DEFAULT '{}',   -- snapshot, survives renames
  monthly_requirement text NOT NULL DEFAULT '',
  status              text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'sent', 'closed')),
  notes               text NOT NULL DEFAULT '',
  source_path         text,
  ip_hash             text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_leads_created ON public.site_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS site_leads_ip_recent ON public.site_leads (ip_hash, created_at DESC);

-- Row-level security. Writes only ever go through server routes with the
-- service-role key. Anonymous reads are limited to published, visible content.
ALTER TABLE public.site_pages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_grades           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_category_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_category_grades  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_media            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_media_links      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_faqs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_revisions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_leads            ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    -- Drafts are never readable anonymously: grant only the public columns.
    REVOKE ALL ON public.site_pages, public.site_categories, public.site_revisions, public.site_leads FROM anon, authenticated;
    GRANT SELECT (key, published, published_at) ON public.site_pages TO anon, authenticated;
    GRANT SELECT (id, parent_id, slug, name, descriptor, sort_order, is_visible, filters, hero_media_id, published, published_at)
      ON public.site_categories TO anon, authenticated;
    GRANT SELECT ON public.site_grades, public.site_category_sources, public.site_category_grades,
      public.site_media, public.site_media_links, public.site_faqs TO anon, authenticated;
  END IF;
END $$;

DROP POLICY IF EXISTS site_pages_read ON public.site_pages;
CREATE POLICY site_pages_read ON public.site_pages FOR SELECT USING (published IS NOT NULL);
DROP POLICY IF EXISTS site_categories_read ON public.site_categories;
CREATE POLICY site_categories_read ON public.site_categories FOR SELECT USING (is_visible);
DROP POLICY IF EXISTS site_grades_read ON public.site_grades;
CREATE POLICY site_grades_read ON public.site_grades FOR SELECT USING (is_visible);
DROP POLICY IF EXISTS site_category_sources_read ON public.site_category_sources;
CREATE POLICY site_category_sources_read ON public.site_category_sources FOR SELECT USING (true);
DROP POLICY IF EXISTS site_category_grades_read ON public.site_category_grades;
CREATE POLICY site_category_grades_read ON public.site_category_grades FOR SELECT USING (true);
DROP POLICY IF EXISTS site_media_read ON public.site_media;
CREATE POLICY site_media_read ON public.site_media FOR SELECT USING (true);
DROP POLICY IF EXISTS site_media_links_read ON public.site_media_links;
CREATE POLICY site_media_links_read ON public.site_media_links FOR SELECT USING (true);
DROP POLICY IF EXISTS site_faqs_read ON public.site_faqs;
CREATE POLICY site_faqs_read ON public.site_faqs FOR SELECT USING (is_visible);
-- site_revisions and site_leads: no policies, so no anonymous access at all.

-- ---------------------------------------------------------------------------
-- Seed: grades and the category tree. Repeat-safe; never overwrites edits.
-- ---------------------------------------------------------------------------
INSERT INTO public.site_grades (code, name, summary, sort_order) VALUES
  ('a',   'A',                  '', 10),
  ('3a',  '3A',                 '', 20),
  ('4a',  '4A',                 '', 30),
  ('5a',  '5A',                 '', 40),
  ('7a',  '7A',                 '', 50),
  ('hd-swiss', 'High Density Swiss', '', 60)
ON CONFLICT (code) DO NOTHING;

-- Top-level categories.
INSERT INTO public.site_categories (parent_id, slug, name, descriptor, sort_order, is_visible, filters)
SELECT NULL, v.slug, v.name, v.descriptor, v.sort_order, v.is_visible, v.filters::jsonb
FROM (VALUES
  ('cz',                  'CZ',                   'Cubic zirconia, 3A to 7A and Swiss high density', 10, true,  '{"shape":true,"size":true,"colour":true,"grade":true}'),
  ('moissanite',          'Moissanite',           'Lab-grown silicon carbide, D–E–F and fancy colours', 20, true, '{"shape":true,"size":true,"colour":true,"grade":false}'),
  ('nano-spinel',         'Nano & Spinel',        'Nano crystal and spinel in calibrated sizes',     30, true,  '{"shape":true,"size":true,"colour":true,"grade":false}'),
  ('ruby-corundum',       'Ruby & Corundum',      'Synthetic ruby, corundum, chatam and cabochons',   40, true,  '{"shape":true,"size":true,"colour":true,"grade":false}'),
  ('lab-grown',           'Lab Grown',            'Lab diamonds, cultivated and precision-cut gems',  50, true,  '{"shape":true,"size":true,"colour":true,"grade":false}'),
  ('polki',               'Polki',                'Flat and foil polki',                             60, true,  '{"shape":true,"size":true,"colour":true,"grade":false}'),
  ('glass-crystal',       'Glass & Crystal',      'Glass stones, foiled glass and crystal',          70, true,  '{"shape":true,"size":true,"colour":true,"grade":false}'),
  ('beads-pearls',        'Beads & Pearls',       'Glass pearls, glass beads and ceramic',           80, true,  '{"shape":true,"size":true,"colour":true,"grade":false}'),
  ('special-categories',  'Special Categories',   'Opal, fusion, evil eye, malachite, MOP and more', 90, true,  '{"shape":true,"size":true,"colour":true,"grade":false}'),
  ('natural',             'Natural',              'Natural emeralds, pearls and semi-precious',      100, true, '{"shape":true,"size":true,"colour":true,"grade":false}'),
  ('jewellery-findings',  'Jewellery & Findings', 'Brass chains and finished jewellery',             110, false,'{"shape":false,"size":false,"colour":false,"grade":false}')
) AS v(slug, name, descriptor, sort_order, is_visible, filters)
WHERE NOT EXISTS (SELECT 1 FROM public.site_categories c WHERE c.parent_id IS NULL AND c.slug = v.slug);

-- Sub-categories: (parent slug, slug, name, sort, visible, grade filter on).
INSERT INTO public.site_categories (parent_id, slug, name, sort_order, is_visible, filters)
SELECT p.id, v.slug, v.name, v.sort_order, v.is_visible,
  jsonb_build_object('shape', true, 'size', true, 'colour', true, 'grade', v.grade)
FROM (VALUES
  ('cz', 'white-cz',            'White CZ',              10, true,  true),
  ('cz', 'coloured-cz',         'Coloured CZ',           20, true,  false),
  ('cz', 'crushed-ice',         'Crushed Ice Cut',       30, true,  false),
  ('cz', 'high-density-swiss',  'High Density Swiss',    40, true,  true),
  ('cz', 'specialty-cz',        'Specialty CZ',          50, true,  false),
  ('nano-spinel', 'nano',       'Nano Crystal',          10, true,  false),
  ('nano-spinel', 'spinel',     'Spinel',                20, false, false),
  ('ruby-corundum', 'synthetic-ruby',     'Synthetic Ruby',      10, true, false),
  ('ruby-corundum', 'synthetic-corundum', 'Synthetic Corundum',  20, true, false),
  ('ruby-corundum', 'rainbow-corundum',   'Rainbow Corundum',    30, true, false),
  ('ruby-corundum', 'opaque-chatam',      'Opaque / Chatam',     40, true, false),
  ('ruby-corundum', 'cabochons',          'Cabochons (Ruby & Green)', 50, true, false),
  ('ruby-corundum', 'glass-filled-ruby',  'Glass-Filled Ruby',   60, true, false),
  ('lab-grown', 'cvd-diamonds',        'CVD Lab Diamonds',     10, true, false),
  ('lab-grown', 'hpht-diamonds',       'HPHT Lab Diamonds',    20, true, false),
  ('lab-grown', 'cultivated-gems',     'Cultivated Gems',      30, true, false),
  ('lab-grown', 'precision-cut-gems',  'Precision Cut Gems',   40, true, false),
  ('polki', 'flat-polki',       'Flat Polki',            10, true,  false),
  ('polki', 'foil-polki',       'Foil Polki',            20, true,  false),
  ('glass-crystal', 'glass-stones',         'Glass Stones',         10, true, false),
  ('glass-crystal', 'foiled-glass-crystal', 'Foiled Glass Crystal', 20, true, false),
  ('glass-crystal', 'crystal',              'Crystal',              30, true, false),
  ('beads-pearls', 'glass-pearls', 'Glass Pearls',       10, true,  false),
  ('beads-pearls', 'glass-beads',  'Glass Beads',        20, true,  false),
  ('beads-pearls', 'ceramic',      'Ceramic',            30, true,  false),
  ('special-categories', 'star-light',         'Star Light',          10, true, false),
  ('special-categories', 'synthetic-opal',     'Synthetic Opal',      20, true, false),
  ('special-categories', 'fusion-stones',      'Fusion Stones',       30, true, false),
  ('special-categories', 'evil-eye',           'Evil Eye',            40, true, false),
  ('special-categories', 'malachite',          'Malachite',           50, true, false),
  ('special-categories', 'mop',                'Mother of Pearl',     60, true, false),
  ('special-categories', 'onyx',               'Onyx',                70, true, false),
  ('special-categories', 'queen-conch',        'Queen Conch',         80, true, false),
  ('special-categories', 'turkey-ring-stones', 'Turkey Ring Stones',  90, true, false),
  ('natural', 'natural-emeralds',  'Emeralds',           10, true,  false),
  ('natural', 'natural-pearls',    'Pearls',             20, true,  false),
  ('natural', 'semi-precious',     'Semi-Precious',      30, true,  false),
  ('jewellery-findings', 'brass-chains', 'Brass Chains', 10, false, false),
  ('jewellery-findings', 'jewellery',    'Brass / Silver / Gold Jewellery', 20, false, false)
) AS v(parent_slug, slug, name, sort_order, is_visible, grade)
JOIN public.site_categories p ON p.parent_id IS NULL AND p.slug = v.parent_slug
WHERE NOT EXISTS (SELECT 1 FROM public.site_categories c WHERE c.parent_id = p.id AND c.slug = v.slug);

-- Sources: which catalogue categories feed each page (by catalogue slug, so
-- the seed is independent of ids). Top-level pages with no sub-categories
-- (Moissanite) get their own source.
INSERT INTO public.site_category_sources (site_category_id, category_id, grade_id, sort_order)
SELECT sc.id, cat.id, g.id, v.sort_order
FROM (VALUES
  ('cz', 'white-cz', '3a-quality-cz', '3a', 10),
  ('cz', 'white-cz', '4a-quality-cz', '4a', 20),
  ('cz', 'white-cz', '5a-quality-cz', '5a', 30),
  ('cz', 'white-cz', '7a-quality',    '7a', 40),
  ('cz', 'high-density-swiss', 'high-density-cz', 'hd-swiss', 10),
  ('cz', 'coloured-cz', 'coloured-cz-stones', NULL, 10),
  ('cz', 'crushed-ice', 'crushed-ice-cut', NULL, 10),
  ('cz', 'specialty-cz', 'heighted-cz-stones', NULL, 10),
  ('cz', 'specialty-cz', 'hole-punched-stones', NULL, 20),
  ('cz', 'specialty-cz', 'preform-balls', NULL, 30),
  ('cz', 'specialty-cz', 'fancy-special-shapes', NULL, 40),
  (NULL, 'moissanite', 'moissanite', NULL, 10),
  ('nano-spinel', 'nano', 'nano', NULL, 10),
  ('ruby-corundum', 'synthetic-ruby', 'ruby-synthetic', NULL, 10),
  ('ruby-corundum', 'synthetic-corundum', 'synthetic-corundum', NULL, 10),
  ('ruby-corundum', 'rainbow-corundum', 'rainbow-corundum', NULL, 10),
  ('ruby-corundum', 'opaque-chatam', 'ruby-opaque-chatam', NULL, 10),
  ('ruby-corundum', 'opaque-chatam', 'green-onyx-chatam', NULL, 20),
  ('ruby-corundum', 'cabochons', 'ruby-green-cabs', NULL, 10),
  ('ruby-corundum', 'glass-filled-ruby', 'ruby-glass-filled', NULL, 10),
  ('lab-grown', 'cultivated-gems', 'lab-grown-stones', NULL, 10),
  ('polki', 'flat-polki', 'flat-polki-foil-polki', NULL, 10),
  ('polki', 'foil-polki', 'flat-polki-foil-polki', NULL, 10),
  ('glass-crystal', 'glass-stones', 'glass-stones', NULL, 10),
  ('glass-crystal', 'foiled-glass-crystal', 'foiled-glass-crystal', NULL, 10),
  ('glass-crystal', 'crystal', 'crystal', NULL, 10),
  ('beads-pearls', 'glass-pearls', 'glass-pearls', NULL, 10),
  ('beads-pearls', 'glass-beads', 'cz-glass-beads', NULL, 10),
  ('beads-pearls', 'ceramic', 'ceramic', NULL, 10),
  ('special-categories', 'star-light', 'star-light', NULL, 10),
  ('special-categories', 'synthetic-opal', 'synthetic-opals', NULL, 10),
  ('special-categories', 'fusion-stones', 'fusion-stones', NULL, 10),
  ('special-categories', 'evil-eye', 'evil-eye-malachite', NULL, 10),
  ('special-categories', 'malachite', 'malachite', NULL, 10),
  ('special-categories', 'mop', 'mop-mother-of-pearl', NULL, 10),
  ('special-categories', 'onyx', 'mop-onyx', NULL, 10),
  ('special-categories', 'queen-conch', 'queen-conch', NULL, 10),
  ('special-categories', 'turkey-ring-stones', 'turkey-ring-stones', NULL, 10),
  ('natural', 'natural-emeralds', 'natural-emeralds', NULL, 10),
  ('natural', 'natural-pearls', 'natural-pearls', NULL, 10),
  ('natural', 'semi-precious', 'semi-precious-stones', NULL, 10)
) AS v(parent_slug, slug, catalogue_slug, grade_code, sort_order)
JOIN public.site_categories sc ON sc.slug = v.slug
  AND ((v.parent_slug IS NULL AND sc.parent_id IS NULL)
    OR sc.parent_id = (SELECT id FROM public.site_categories WHERE parent_id IS NULL AND slug = v.parent_slug))
JOIN public.categories cat ON cat.slug = v.catalogue_slug
LEFT JOIN public.site_grades g ON g.code = v.grade_code
ON CONFLICT (site_category_id, category_id) DO NOTHING;

-- Grades that apply to a page = grades named by its sources.
INSERT INTO public.site_category_grades (site_category_id, grade_id)
SELECT DISTINCT site_category_id, grade_id FROM public.site_category_sources WHERE grade_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.site_pages (key) VALUES
  ('global'), ('home'), ('about'), ('quality'), ('how-to-order'), ('request-catalogue'), ('faq'), ('contact'), ('charts')
ON CONFLICT (key) DO NOTHING;

COMMIT;
