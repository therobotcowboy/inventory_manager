-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Locations Table
create table locations (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  type text check (type in ('VAN', 'SHELF', 'BIN', 'JOB_SITE')) default 'VAN',
  created_at timestamptz default now()
);

-- 2. Items Table
create table items (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  quantity int default 0,
  location_id uuid references locations(id),
  category text,
  low_stock_threshold int default 5,
  updated_at timestamptz default now()
);

-- 3. Audit Logs (History)
create table audit_logs (
  id uuid default uuid_generate_v4() primary key,
  item_id uuid references items(id),
  action text not null, -- ADD, REMOVE, CHECK, MOVE
  quantity_change int,
  voice_transcript text, -- Store the original command
  timestamp timestamptz default now()
);

-- RLS Policies (Simple for MVP: Enable all for anon)
alter table locations enable row level security;
alter table items enable row level security;
alter table audit_logs enable row level security;

create policy "Enable all access for anon" on locations for all using (true);
create policy "Enable all access for anon" on items for all using (true);
create policy "Enable all access for anon" on audit_logs for all using (true);

-- Seed Data (Optional)
insert into locations (name, type) values 
  ('Van 1', 'VAN'),
  ('Workshop Shelf A', 'SHELF');
