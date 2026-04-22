begin;

create extension if not exists "uuid-ossp";

create table if not exists public.restaurant_menu_settings (
  key text primary key,
  show_prices_on_website boolean not null default false,
  show_non_veg boolean not null default false,
  menu_note text null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.restaurant_menu_sections (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  website_heading text null,
  description text null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.restaurant_menu_items (
  id uuid primary key default uuid_generate_v4(),
  section_id uuid not null references public.restaurant_menu_sections(id) on delete cascade,
  item_code text null,
  name text not null,
  description text null,
  portion_label text null,
  unit text null,
  price numeric(10,2) not null default 0,
  discount_price numeric(10,2) null,
  is_veg boolean not null default true,
  is_active boolean not null default true,
  is_visible_on_website boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.restaurant_menu_items
  add column if not exists unit text null,
  add column if not exists discount_price numeric(10,2) null;

update public.restaurant_menu_items
set unit = coalesce(unit, portion_label)
where unit is null;

create index if not exists restaurant_menu_items_section_idx on public.restaurant_menu_items(section_id, sort_order);

insert into public.restaurant_menu_settings (key, show_prices_on_website, show_non_veg, menu_note)
values ('primary', false, false, 'Pure veg menu. Prices remain hidden on the website until enabled by admin.')
on conflict (key) do update set
  menu_note = excluded.menu_note,
  updated_at = now();

insert into public.restaurant_menu_sections (slug, name, website_heading, sort_order, description)
values
  ('snacks', 'Snacks', 'Snacks', 10, 'Quick bites and popular starters'),
  ('taste-of-uttarakhand', 'Taste of Uttarakhand', 'Taste of Uttarakhand', 20, 'Regional favourites and signature local plates'),
  ('gravy', 'Gravy', 'Gravy', 30, 'Dal and curry-based mains'),
  ('veg-main-course', 'Veg Main Course', 'Veg Main Course', 40, 'Pure veg curries and sabzi selections'),
  ('breads', 'Breads', 'Breads', 50, 'Fresh breads and parathas'),
  ('rice', 'Rice', 'Rice', 60, 'Rice sides and comfort bowls'),
  ('breakfast', 'Breakfast', 'Breakfast', 70, 'Breakfast classics and hill-style plates'),
  ('south-indian', 'South Indian', 'South', 80, 'Dosa, idli and uttapam'),
  ('noodles-pasta', 'Noodles & Pasta', 'Noodles & Pasta', 90, 'Fast comfort dishes'),
  ('drinks-desserts', 'Drinks & Desserts', 'Drinks & Desserts', 100, 'Beverages and sweet finishers'),
  ('salad', 'Salad', 'Salad', 110, 'Fresh salads and papad'),
  ('thali', 'Thali', 'Thali', 120, 'Complete meal platters'),
  ('raita', 'Raita', 'Raita', 130, 'Cooling curd accompaniments'),
  ('soup-bowls', 'Soup Bowls', 'Soup Bowls', 140, 'Soup and warm starters')
on conflict (slug) do update set
  name = excluded.name,
  website_heading = excluded.website_heading,
  sort_order = excluded.sort_order,
  description = excluded.description,
  updated_at = now();

insert into public.restaurant_menu_items (section_id, name, portion_label, unit, price, sort_order, is_veg, is_active, is_visible_on_website)
select s.id, v.item_name, v.unit_label, v.unit_label, v.price, v.sort_order, true, true, true
from public.restaurant_menu_sections s
join (
  values
    ('snacks', 'Paneer Pakoda', 'Portion', 300, 10),
    ('snacks', 'French Fries', 'Portion', 200, 20),
    ('snacks', 'Honey Chilli Potato', 'Portion', 250, 30),
    ('snacks', 'Mushroom Kabana', 'Portion', 280, 40),
    ('snacks', 'Crispy Corn', 'Portion', 280, 50),
    ('snacks', 'Masala Corn', 'Portion', 250, 60),
    ('snacks', 'Cheese Masala Corn', 'Portion', 350, 70),
    ('snacks', 'Mint Masala Corn', 'Portion', 280, 80),
    ('snacks', 'Grilled Sandwich', 'Portion', 150, 90),
    ('snacks', 'Soya Chilli', 'Portion', 250, 100),
    ('snacks', 'Paneer Chilli', 'Portion', 360, 110),
    ('snacks', 'Mushroom Chilli', 'Portion', 300, 120),
    ('snacks', 'Cauliflower 65', 'Portion', 250, 130),
    ('snacks', 'Mushroom Tikka', 'Portion', 320, 140),
    ('snacks', 'Paneer Tikka', 'Portion', 380, 150),
    ('taste-of-uttarakhand', 'Toor Dal', 'Portion', 350, 10),
    ('taste-of-uttarakhand', 'Kulath Dal', 'Portion', 350, 20),
    ('taste-of-uttarakhand', 'Rajma Harshil', 'Portion', 400, 30),
    ('taste-of-uttarakhand', 'Chausa', 'Portion', 300, 40),
    ('taste-of-uttarakhand', 'Kandali Saag', 'Portion', 220, 50),
    ('taste-of-uttarakhand', 'Jholi', 'Portion', 250, 60),
    ('taste-of-uttarakhand', 'Aloo Thichwani', 'Portion', 220, 70),
    ('taste-of-uttarakhand', 'Kumauni Raita', 'Portion', 250, 80),
    ('taste-of-uttarakhand', 'Aaloo Gutke', 'Portion', 220, 90),
    ('taste-of-uttarakhand', 'Lingde Ki Sabji', 'Portion', 260, 100),
    ('taste-of-uttarakhand', 'Navratan Dal', 'Portion', 300, 110),
    ('taste-of-uttarakhand', 'Jhangora', 'Portion', 220, 120),
    ('taste-of-uttarakhand', 'Red Rice', 'Portion', 220, 130),
    ('taste-of-uttarakhand', 'Mandwa Roti', 'Piece', 70, 140),
    ('taste-of-uttarakhand', 'Stuffed Paratha Kulth', 'Portion', 150, 150),
    ('taste-of-uttarakhand', 'Jhangora Kheer', 'Portion', 300, 160),
    ('taste-of-uttarakhand', 'Leafwalk Special Thali', 'Plate', 650, 170),
    ('taste-of-uttarakhand', 'Leafwalk Special Breakfast', 'Plate', 320, 180),
    ('gravy', 'Dal Tadka', 'Portion', 280, 10),
    ('gravy', 'Rajma', 'Portion', 250, 20),
    ('gravy', 'Dal Makhani', 'Portion', 300, 30),
    ('gravy', 'Chole', 'Portion', 250, 40),
    ('gravy', 'Sarson Saag', 'Portion', 200, 50),
    ('veg-main-course', 'Matar Paneer', 'Portion', 320, 10),
    ('veg-main-course', 'Gravy Mushroom', 'Portion', 360, 20),
    ('veg-main-course', 'Kadhai Paneer', 'Portion', 400, 30),
    ('veg-main-course', 'Paneer Butter Masala', 'Portion', 400, 40),
    ('veg-main-course', 'Mix Veg', 'Portion', 300, 50),
    ('veg-main-course', 'Aaloo Gobhi', 'Portion', 250, 60),
    ('veg-main-course', 'Aaloo Matar', 'Portion', 250, 70),
    ('veg-main-course', 'Bhindi', 'Portion', 250, 80),
    ('veg-main-course', 'Bhindi Masala', 'Portion', 280, 90),
    ('veg-main-course', 'Aaloo Simla', 'Portion', 250, 100),
    ('veg-main-course', 'Matar Mushroom', 'Portion', 280, 110),
    ('veg-main-course', 'Aaloo Jeera', 'Portion', 200, 120),
    ('veg-main-course', 'Aaloo Methi', 'Portion', 200, 130),
    ('breads', 'Chapati', 'Per Piece', 20, 10),
    ('breads', 'Butter Chapati', 'Per Piece', 25, 20),
    ('breads', 'Laccha Paratha', 'Per Piece', 70, 30),
    ('rice', 'Steamed Rice', 'Portion', 180, 10),
    ('rice', 'Jeera Rice', 'Portion', 200, 20),
    ('rice', 'Veg Fried Rice', 'Portion', 250, 30),
    ('rice', 'Curd Rice', 'Portion', 260, 40),
    ('breakfast', 'Cheese Sandwich', 'Portion', 180, 10),
    ('breakfast', 'Aaloo Paratha', 'Portion', 80, 20),
    ('breakfast', 'Paneer Paratha', 'Portion', 120, 30),
    ('breakfast', 'Gobhi Paratha', 'Portion', 100, 40),
    ('breakfast', 'Aaloo Puri', 'Portion', 180, 50),
    ('breakfast', 'Chole Puri', 'Portion', 200, 60),
    ('breakfast', 'Methi Paratha', 'Portion', 70, 70),
    ('breakfast', 'Poha', 'Portion', 250, 80),
    ('breakfast', 'Masala Oats', 'Portion', 200, 90),
    ('breakfast', 'Butter Toast', 'Portion', 70, 100),
    ('south-indian', 'Idli Sambhar', 'Portion', 250, 10),
    ('south-indian', 'Uttapam', 'Portion', 200, 20),
    ('south-indian', 'Vada Sambhar', 'Portion', 140, 30),
    ('south-indian', 'Plain Dosa', 'Portion', 160, 40),
    ('south-indian', 'Masala Dosa', 'Portion', 220, 50),
    ('south-indian', 'Paneer Dosa', 'Portion', 280, 60),
    ('noodles-pasta', 'Garden Green Hakka Noodles', 'Portion', 200, 10),
    ('noodles-pasta', 'Plain Noodles', 'Portion', 120, 20),
    ('noodles-pasta', 'Plain Maggi', 'Portion', 70, 30),
    ('noodles-pasta', 'Veg Maggi', 'Portion', 100, 40),
    ('noodles-pasta', 'Maggi Makhani', 'Portion', 140, 50),
    ('noodles-pasta', 'Red Sauce Pasta', 'Portion', 200, 60),
    ('noodles-pasta', 'White Sauce Pasta', 'Portion', 250, 70),
    ('drinks-desserts', 'Tea', 'Cup', 40, 10),
    ('drinks-desserts', 'Green Tea', 'Cup', 40, 20),
    ('drinks-desserts', 'Lemon Tea', 'Cup', 40, 30),
    ('drinks-desserts', 'Masala Tea', 'Cup', 50, 40),
    ('drinks-desserts', 'Coffee', 'Cup', 80, 50),
    ('drinks-desserts', 'Black Coffee', 'Cup', 60, 60),
    ('drinks-desserts', 'Mineral Water', 'Bottle', 40, 70),
    ('drinks-desserts', 'Cold Drinks', 'Bottle', 0, 80),
    ('drinks-desserts', 'Milk Glass', 'Glass', 80, 90),
    ('drinks-desserts', 'Cold Coffee', 'Glass', 120, 100),
    ('drinks-desserts', 'Lemon Soda', 'Glass', 60, 110),
    ('drinks-desserts', 'Nimbu Pani', 'Glass', 40, 120),
    ('drinks-desserts', 'Rasgulla', 'Portion', 80, 130),
    ('drinks-desserts', 'Gulab Jamun', 'Portion', 80, 140),
    ('drinks-desserts', 'Kheer', 'Portion', 120, 150),
    ('salad', 'Hara Bhara Salad', 'Portion', 120, 10),
    ('salad', 'Onion Salad', 'Portion', 50, 20),
    ('salad', 'Cucumber Salad', 'Portion', 80, 30),
    ('salad', 'Plain Papad', '2 pc', 40, 40),
    ('salad', 'Fried Papad', '2 pc', 50, 50),
    ('salad', 'Masala Papad', '2 pc', 150, 60),
    ('thali', 'Thali Ghar Jaisi', 'Plate', 350, 10),
    ('thali', 'Special Thali', 'Plate', 450, 20),
    ('raita', 'Mix Raita', 'Portion', 200, 10),
    ('raita', 'Boondi Raita', 'Portion', 150, 20),
    ('raita', 'Cucumber Raita', 'Portion', 150, 30),
    ('raita', 'Plain Curd', 'Portion', 80, 40),
    ('soup-bowls', 'Minestrone Veg Soup', 'Bowl', 200, 10),
    ('soup-bowls', 'Mushroom Cappuccino', 'Bowl', 250, 20),
    ('soup-bowls', 'Hot and Sour Soup', 'Bowl', 250, 30),
    ('soup-bowls', 'Lung Fung Soup', 'Bowl', 250, 40),
    ('soup-bowls', 'Tomato Soup', 'Bowl', 200, 50),
    ('soup-bowls', 'Dal Shorba', 'Bowl', 200, 60),
    ('soup-bowls', 'Veg Clear Soup', 'Bowl', 220, 70)
) as v(section_slug, item_name, unit_label, price, sort_order)
  on s.slug = v.section_slug
where not exists (
  select 1
  from public.restaurant_menu_items i
  where i.section_id = s.id
    and lower(i.name) = lower(v.item_name)
);

commit;
