-- YOYO GEMS backend schema + master data seed
-- Run this once in Supabase SQL editor after creating your project

create table if not exists categories (
  id serial primary key,
  num int not null,
  name text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

create table if not exists shapes (
  id serial primary key,
  name text unique not null
);

create table if not exists shape_sizes (
  id serial primary key,
  shape_id int references shapes(id) on delete cascade,
  size_mm text not null,
  weight_ct numeric
);

create table if not exists colors (
  id serial primary key,
  name text unique not null
);

create table if not exists tags (
  id serial primary key,
  name text unique not null,
  is_global boolean default true
);

create table if not exists category_shapes (
  category_id int references categories(id) on delete cascade,
  shape_id int references shapes(id) on delete cascade,
  primary key (category_id, shape_id)
);

create table if not exists category_colors (
  category_id int references categories(id) on delete cascade,
  color_id int references colors(id) on delete cascade,
  primary key (category_id, color_id)
);

create table if not exists category_tags (
  category_id int references categories(id) on delete cascade,
  tag_id int references tags(id) on delete cascade,
  primary key (category_id, tag_id)
);

create table if not exists photos (
  id serial primary key,
  category_id int references categories(id) on delete cascade,
  storage_path text,
  drive_id text,
  shape_id int references shapes(id) on delete set null,
  shape_size_id int references shape_sizes(id) on delete set null,
  color_id int references colors(id) on delete set null,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table if not exists photo_tags (
  photo_id int references photos(id) on delete cascade,
  tag_id int references tags(id) on delete cascade,
  primary key (photo_id, tag_id)
);

-- Public read access (catalogue is public-facing)
alter table categories enable row level security;
alter table shapes enable row level security;
alter table shape_sizes enable row level security;
alter table colors enable row level security;
alter table tags enable row level security;
alter table category_shapes enable row level security;
alter table category_colors enable row level security;
alter table category_tags enable row level security;
alter table photos enable row level security;
alter table photo_tags enable row level security;

create policy "public read categories" on categories for select using (true);
create policy "public read shapes" on shapes for select using (true);
create policy "public read shape_sizes" on shape_sizes for select using (true);
create policy "public read colors" on colors for select using (true);
create policy "public read tags" on tags for select using (true);
create policy "public read category_shapes" on category_shapes for select using (true);
create policy "public read category_colors" on category_colors for select using (true);
create policy "public read category_tags" on category_tags for select using (true);
create policy "public read photos" on photos for select using (true);
create policy "public read photo_tags" on photo_tags for select using (true);

-- Writes happen only via the server (service role key), which bypasses RLS,
-- so no public write policies are defined -- the admin panel is the only writer.
-- Categories
insert into categories (num, name, slug) values (1, 'Crushed Ice Cut', 'crushed-ice-cut');
insert into categories (num, name, slug) values (3, 'Ruby Synthetic', 'ruby-synthetic');
insert into categories (num, name, slug) values (4, 'Nano', 'nano');
insert into categories (num, name, slug) values (5, 'Turkey Ring Stones', 'turkey-ring-stones');
insert into categories (num, name, slug) values (6, 'Ruby & Green Cabs', 'ruby-green-cabs');
insert into categories (num, name, slug) values (7, 'Lab Grown Stones', 'lab-grown-stones');
insert into categories (num, name, slug) values (9, 'Evil Eye & Malachite', 'evil-eye-malachite');
insert into categories (num, name, slug) values (10, 'MOP & Onyx', 'mop-onyx');
insert into categories (num, name, slug) values (11, 'Synthetic Opals', 'synthetic-opals');
insert into categories (num, name, slug) values (12, 'Fusion Stones', 'fusion-stones');
insert into categories (num, name, slug) values (13, 'Bi & Tri Colour Fusion Stone', 'bi-tri-colour-fusion-stone');
insert into categories (num, name, slug) values (14, 'Coloured CZ Stones', 'coloured-cz-stones');
insert into categories (num, name, slug) values (15, 'Queen Conch', 'queen-conch');
insert into categories (num, name, slug) values (16, 'CZ & Glass Beads', 'cz-glass-beads');
insert into categories (num, name, slug) values (17, 'Glass Stones', 'glass-stones');
insert into categories (num, name, slug) values (18, 'Glass Pearls', 'glass-pearls');
insert into categories (num, name, slug) values (19, 'Crystal', 'crystal');
insert into categories (num, name, slug) values (20, 'Foiled Glass Crystal', 'foiled-glass-crystal');
insert into categories (num, name, slug) values (21, 'Flat Polki & Foil Polki', 'flat-polki-foil-polki');
insert into categories (num, name, slug) values (22, 'Hole Punched Stones', 'hole-punched-stones');
insert into categories (num, name, slug) values (23, 'Natural Emeralds', 'natural-emeralds');
insert into categories (num, name, slug) values (24, 'Natural Pearls', 'natural-pearls');
insert into categories (num, name, slug) values (25, 'Ruby Glass Filled', 'ruby-glass-filled');
insert into categories (num, name, slug) values (26, 'Semi Precious Stones', 'semi-precious-stones');
insert into categories (num, name, slug) values (27, 'Green Onyx & Chatam', 'green-onyx-chatam');
insert into categories (num, name, slug) values (28, 'Ruby Opaque (Chatam)', 'ruby-opaque-chatam');
insert into categories (num, name, slug) values (29, 'Preform & Balls', 'preform-balls');
insert into categories (num, name, slug) values (30, 'Fancy Special Shapes', 'fancy-special-shapes');
insert into categories (num, name, slug) values (31, 'Rainbow Corundum', 'rainbow-corundum');
insert into categories (num, name, slug) values (32, 'Pure Form', 'pure-form');
insert into categories (num, name, slug) values (33, 'Star Light', 'star-light');
insert into categories (num, name, slug) values (34, '7A Quality', '7a-quality');

-- Shapes + sizes
insert into shapes (name) values ('Round');
insert into shapes (name) values ('Pear/Oval');
insert into shapes (name) values ('Square');
insert into shapes (name) values ('Marquise');
insert into shapes (name) values ('Trillion');
insert into shapes (name) values ('Cushion');
insert into shapes (name) values ('Asscher');
insert into shapes (name) values ('Octagon Step Cut');
insert into shapes (name) values ('Triangle');
insert into shapes (name) values ('D-Cut Shape');
insert into shapes (name) values ('Leaf Clover');
insert into shapes (name) values ('Octagon Princess');
insert into shapes (name) values ('Hexagon Queen Cut');
insert into shapes (name) values ('Kite');
insert into shapes (name) values ('Eight Diagram');
insert into shapes (name) values ('Lily');
insert into shapes (name) values ('Half Moon');
insert into shapes (name) values ('Hexagon Step Cut');
insert into shapes (name) values ('Lozenge');
insert into shapes (name) values ('Bucket Shape');
insert into shapes (name) values ('Rose Cut');
insert into shapes (name) values ('Gourd');
insert into shapes (name) values ('Heart');
insert into shapes (name) values ('Long Diamond Cut');
insert into shapes (name) values ('Long Hexagon');
insert into shapes (name) values ('Diamond Shape');
insert into shapes (name) values ('Arrow');
insert into shapes (name) values ('Special Pear');
insert into shapes (name) values ('Pentagon');
insert into shapes (name) values ('Shield Shape');
insert into shapes (name) values ('Trapezoid');
insert into shapes (name) values ('Baguette');
insert into shapes (name) values ('Baguette Princess');
insert into shapes (name) values ('Star');
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '0.70', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '0.80', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '0.90', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '1.00', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '1.10', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '1.20', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '1.30', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '1.40', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '1.50', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '1.60', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '1.70', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '1.80', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '1.90', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.00', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.10', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.20', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.30', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.40', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.50', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.60', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.70', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.80', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.90', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3.00', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3.10', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3.20', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3.30', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3.40', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3.50', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3.60', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3.70', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3.80', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3.90', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4.00', 0.09 from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4.25', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4.50', 0.13 from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4.75', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5.00', 0.17 from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5.25', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5.50', 0.23 from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5.75', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6.00', 0.3 from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6.25', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6.50', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6.75', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7.00', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7.50', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8.00', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8.50', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '9.00', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '9.50', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '10.00', null from shapes where name = 'Round';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '1.5x2', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '1.5x2.5', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2x2.5', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2x3', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2x3.5', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.25x3.25', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.5x3', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.5x3.5', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.75x3.75', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3x4', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3.25x4.25', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3.5x4.5', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3x5', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3.5x5.5', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3.75x4.75', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x5', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x6', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4.25x5.25', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4.5x5.5', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4.75x5.75', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4.5x6.5', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x6', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x7', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5.5x7.5', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x8', 0.39 from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6.5x8.5', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x9', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x10', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '9x11', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '9x13', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '10x12', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '10x14', null from shapes where name = 'Pear/Oval';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '1.25x1.25', null from shapes where name = 'Square';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '1.5x1.5', null from shapes where name = 'Square';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '1.75x1.75', null from shapes where name = 'Square';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2x2', null from shapes where name = 'Square';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.25x2.25', null from shapes where name = 'Square';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.5x2.5', null from shapes where name = 'Square';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.75x2.75', null from shapes where name = 'Square';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3x3', 0.03 from shapes where name = 'Square';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3.25x3.25', null from shapes where name = 'Square';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3.5x3.5', 0.05 from shapes where name = 'Square';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3.75x3.75', null from shapes where name = 'Square';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x4', 0.08 from shapes where name = 'Square';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4.5x4.5', null from shapes where name = 'Square';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x5', 0.13 from shapes where name = 'Square';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5.5x5.5', 0.21 from shapes where name = 'Square';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x6', 0.36 from shapes where name = 'Square';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6.5x6.5', null from shapes where name = 'Square';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x7', null from shapes where name = 'Square';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7.5x7.5', null from shapes where name = 'Square';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x8', null from shapes where name = 'Square';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '1.5x2.5', null from shapes where name = 'Marquise';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '1.5x2.75', null from shapes where name = 'Marquise';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '1.5x3', null from shapes where name = 'Marquise';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '1.50x3.5', null from shapes where name = 'Marquise';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '1.75x3.5', null from shapes where name = 'Marquise';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2x3', null from shapes where name = 'Marquise';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2x3.5', null from shapes where name = 'Marquise';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2x4', null from shapes where name = 'Marquise';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2x4.5', null from shapes where name = 'Marquise';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.25x3.25', null from shapes where name = 'Marquise';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.25x4.25', null from shapes where name = 'Marquise';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.5x3.5', null from shapes where name = 'Marquise';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.5x4', null from shapes where name = 'Marquise';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.5x4.5', null from shapes where name = 'Marquise';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.5x5', null from shapes where name = 'Marquise';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.75x5.5', null from shapes where name = 'Marquise';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3x5', null from shapes where name = 'Marquise';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3x6', null from shapes where name = 'Marquise';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3.5x7', null from shapes where name = 'Marquise';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x8', 0.17 from shapes where name = 'Marquise';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4.5x9', null from shapes where name = 'Marquise';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x10', null from shapes where name = 'Marquise';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x12', null from shapes where name = 'Marquise';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3x3', 0.03 from shapes where name = 'Trillion';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x4', 0.07 from shapes where name = 'Trillion';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x5', 0.13 from shapes where name = 'Trillion';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x6', 0.22 from shapes where name = 'Trillion';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x7', null from shapes where name = 'Trillion';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x8', null from shapes where name = 'Trillion';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '9x9', null from shapes where name = 'Trillion';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '10x10', null from shapes where name = 'Trillion';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3x3', null from shapes where name = 'Cushion';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x4', null from shapes where name = 'Cushion';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x5', null from shapes where name = 'Cushion';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x6', 0.32 from shapes where name = 'Cushion';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x7', null from shapes where name = 'Cushion';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x8', null from shapes where name = 'Cushion';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '9x9', null from shapes where name = 'Cushion';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '10x10', null from shapes where name = 'Cushion';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3x3', null from shapes where name = 'Asscher';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x4', null from shapes where name = 'Asscher';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x5', null from shapes where name = 'Asscher';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x6', 0.36 from shapes where name = 'Asscher';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x7', null from shapes where name = 'Asscher';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x8', null from shapes where name = 'Asscher';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '9x9', null from shapes where name = 'Asscher';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '10x10', null from shapes where name = 'Asscher';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3x5', null from shapes where name = 'Octagon Step Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x6', null from shapes where name = 'Octagon Step Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x7', null from shapes where name = 'Octagon Step Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x8', 0.53 from shapes where name = 'Octagon Step Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x9', null from shapes where name = 'Octagon Step Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x10', null from shapes where name = 'Octagon Step Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3x3', null from shapes where name = 'Triangle';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x4', null from shapes where name = 'Triangle';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x5', null from shapes where name = 'Triangle';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x6', 0.24 from shapes where name = 'Triangle';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x7', null from shapes where name = 'Triangle';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x8', null from shapes where name = 'Triangle';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '9x9', null from shapes where name = 'Triangle';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '10x10', null from shapes where name = 'Triangle';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x6', 0.34 from shapes where name = 'D-Cut Shape';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x8', 0.83 from shapes where name = 'D-Cut Shape';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '10x10', 1.56 from shapes where name = 'D-Cut Shape';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3x3', null from shapes where name = 'Leaf Clover';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x4', 0.09 from shapes where name = 'Leaf Clover';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x5', 0.17 from shapes where name = 'Leaf Clover';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x6', 0.34 from shapes where name = 'Leaf Clover';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x7', 0.55 from shapes where name = 'Leaf Clover';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x8', 0.79 from shapes where name = 'Leaf Clover';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '10x10', 1.58 from shapes where name = 'Leaf Clover';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '12x12', 2.79 from shapes where name = 'Leaf Clover';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3x5', null from shapes where name = 'Octagon Princess';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x6', null from shapes where name = 'Octagon Princess';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x7', null from shapes where name = 'Octagon Princess';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x8', 0.5 from shapes where name = 'Octagon Princess';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x9', null from shapes where name = 'Octagon Princess';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x10', null from shapes where name = 'Octagon Princess';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3x3', 0.04 from shapes where name = 'Hexagon Queen Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x4', 0.11 from shapes where name = 'Hexagon Queen Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x5', 0.2 from shapes where name = 'Hexagon Queen Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x6', 0.32 from shapes where name = 'Hexagon Queen Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x7', 0.53 from shapes where name = 'Hexagon Queen Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x8', 0.87 from shapes where name = 'Hexagon Queen Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '10x10', 1.66 from shapes where name = 'Hexagon Queen Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '12x12', null from shapes where name = 'Hexagon Queen Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3x6', 0.06 from shapes where name = 'Kite';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3.5x7', 0.09 from shapes where name = 'Kite';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x7', 0.12 from shapes where name = 'Kite';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x8', 0.13 from shapes where name = 'Kite';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x9', 0.22 from shapes where name = 'Kite';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x10', 0.25 from shapes where name = 'Kite';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x10', 0.39 from shapes where name = 'Kite';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x11', 0.51 from shapes where name = 'Kite';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '9x16', 1.31 from shapes where name = 'Kite';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3x3', 0.04 from shapes where name = 'Eight Diagram';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x4', 0.13 from shapes where name = 'Eight Diagram';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x5', 0.21 from shapes where name = 'Eight Diagram';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x6', 0.33 from shapes where name = 'Eight Diagram';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x7', 0.53 from shapes where name = 'Eight Diagram';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x8', 0.78 from shapes where name = 'Eight Diagram';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '10x10', 1.44 from shapes where name = 'Eight Diagram';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '12x12', 2.4 from shapes where name = 'Eight Diagram';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3x3', 0.04 from shapes where name = 'Lily';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x4', 0.11 from shapes where name = 'Lily';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x5', 0.2 from shapes where name = 'Lily';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x6', 0.36 from shapes where name = 'Lily';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x7', 0.51 from shapes where name = 'Lily';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x8', 0.81 from shapes where name = 'Lily';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '10x10', 1.56 from shapes where name = 'Lily';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '12x12', 2.85 from shapes where name = 'Lily';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x6', 0.14 from shapes where name = 'Half Moon';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x7', 0.26 from shapes where name = 'Half Moon';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x8', 0.32 from shapes where name = 'Half Moon';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x10', 0.43 from shapes where name = 'Half Moon';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x12', 0.63 from shapes where name = 'Half Moon';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x4', 0.1 from shapes where name = 'Hexagon Step Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x5', 0.2 from shapes where name = 'Hexagon Step Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x6', 0.33 from shapes where name = 'Hexagon Step Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x7', 0.49 from shapes where name = 'Hexagon Step Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x8', 0.78 from shapes where name = 'Hexagon Step Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '10x10', 1.65 from shapes where name = 'Hexagon Step Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '12x12', 2.66 from shapes where name = 'Hexagon Step Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2x4', 0.01 from shapes where name = 'Lozenge';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '2.5x5', 0.03 from shapes where name = 'Lozenge';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3x5', 0.04 from shapes where name = 'Lozenge';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3x6', 0.06 from shapes where name = 'Lozenge';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x8', 0.13 from shapes where name = 'Lozenge';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5.5x9.5', 0.39 from shapes where name = 'Lozenge';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x6', 0.14 from shapes where name = 'Bucket Shape';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x7', 0.26 from shapes where name = 'Bucket Shape';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x8', 0.41 from shapes where name = 'Bucket Shape';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x9', 0.62 from shapes where name = 'Bucket Shape';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x4', 0.1 from shapes where name = 'Rose Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x5', 0.19 from shapes where name = 'Rose Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x6', 0.36 from shapes where name = 'Rose Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x7', 0.54 from shapes where name = 'Rose Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x8', 0.84 from shapes where name = 'Rose Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '10x10', 1.64 from shapes where name = 'Rose Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '12x12', 2.79 from shapes where name = 'Rose Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x9', 0.59 from shapes where name = 'Gourd';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x10', 0.87 from shapes where name = 'Gourd';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x11', 0.89 from shapes where name = 'Gourd';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x12', 1.05 from shapes where name = 'Gourd';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3x3', 0.03 from shapes where name = 'Heart';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3.5x3.5', 0.05 from shapes where name = 'Heart';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x4', 0.08 from shapes where name = 'Heart';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x5', 0.13 from shapes where name = 'Heart';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5.5x5.5', 0.21 from shapes where name = 'Heart';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x6', 0.28 from shapes where name = 'Heart';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x7', null from shapes where name = 'Heart';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x8', null from shapes where name = 'Heart';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '9x9', null from shapes where name = 'Heart';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '10x10', null from shapes where name = 'Heart';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x7', 0.21 from shapes where name = 'Long Diamond Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x8', 0.31 from shapes where name = 'Long Diamond Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x9', 0.51 from shapes where name = 'Long Diamond Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x10', 0.69 from shapes where name = 'Long Diamond Cut';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x7', 0.23 from shapes where name = 'Long Hexagon';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x8', 0.38 from shapes where name = 'Long Hexagon';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x9', 0.5 from shapes where name = 'Long Hexagon';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x12', 1.06 from shapes where name = 'Long Hexagon';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '9x13', 1.56 from shapes where name = 'Long Hexagon';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x7', 0.2 from shapes where name = 'Diamond Shape';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x8', 0.3 from shapes where name = 'Diamond Shape';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x9', 0.47 from shapes where name = 'Diamond Shape';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x10', 0.71 from shapes where name = 'Diamond Shape';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x7', 0.16 from shapes where name = 'Arrow';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x8', 0.27 from shapes where name = 'Arrow';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x9', 0.42 from shapes where name = 'Arrow';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x10', 0.66 from shapes where name = 'Arrow';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x7', 0.24 from shapes where name = 'Special Pear';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x8', 0.37 from shapes where name = 'Special Pear';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x9', 0.53 from shapes where name = 'Special Pear';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x10', 0.78 from shapes where name = 'Special Pear';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x4', 0.08 from shapes where name = 'Pentagon';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x5', 0.15 from shapes where name = 'Pentagon';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x6', 0.26 from shapes where name = 'Pentagon';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x8', 0.27 from shapes where name = 'Shield Shape';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x9', 0.47 from shapes where name = 'Shield Shape';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x10', 0.69 from shapes where name = 'Shield Shape';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x6x8', null from shapes where name = 'Trapezoid';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3x5', null from shapes where name = 'Baguette';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x6', null from shapes where name = 'Baguette';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x7', null from shapes where name = 'Baguette';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x8', 0.56 from shapes where name = 'Baguette';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x9', null from shapes where name = 'Baguette';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x10', null from shapes where name = 'Baguette';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3x5', null from shapes where name = 'Baguette Princess';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x6', null from shapes where name = 'Baguette Princess';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x7', null from shapes where name = 'Baguette Princess';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x8', 0.51 from shapes where name = 'Baguette Princess';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x9', null from shapes where name = 'Baguette Princess';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x10', null from shapes where name = 'Baguette Princess';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3x3', 0.02 from shapes where name = 'Star';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '3.5x3.5', 0.04 from shapes where name = 'Star';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4x4', 0.09 from shapes where name = 'Star';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '4.5x4.5', 0.09 from shapes where name = 'Star';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5x5', 0.13 from shapes where name = 'Star';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '5.5x5.5', 0.16 from shapes where name = 'Star';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '6x6', 0.21 from shapes where name = 'Star';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '7x7', null from shapes where name = 'Star';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '8x8', null from shapes where name = 'Star';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '9x9', null from shapes where name = 'Star';
insert into shape_sizes (shape_id, size_mm, weight_ct) select id, '10x10', null from shapes where name = 'Star';

-- Colors
insert into colors (name) values ('Colorless / White');
insert into colors (name) values ('Canary Yellow');
insert into colors (name) values ('Champagne');
insert into colors (name) values ('Emerald Green');
insert into colors (name) values ('Royal Blue');
insert into colors (name) values ('Ruby Red');
insert into colors (name) values ('Rose Pink');
insert into colors (name) values ('Aquamarine');
insert into colors (name) values ('Black');
insert into colors (name) values ('Lavender');
insert into colors (name) values ('Tanzanite Blue');
insert into colors (name) values ('Amethyst Purple');
insert into colors (name) values ('Peridot Green');
insert into colors (name) values ('Olive Green');
insert into colors (name) values ('Garnet Red');
insert into colors (name) values ('Morganite Pink');
insert into colors (name) values ('Swiss Blue');
insert into colors (name) values ('Apple Green');
insert into colors (name) values ('Golden Amber');
