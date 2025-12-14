-- FULL REPAIR SCRIPT V5
-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. Reset Schema (Drop known tables to ensure clean state)
DROP TABLE IF EXISTS inventory_transactions CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;

-- 2. Create Locations (Hierarchy)
CREATE TABLE locations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ROOT', 'LOCATION', 'AREA', 'CONTAINER')), 
  parent_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  is_system_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Roots
INSERT INTO locations (id, name, type, is_system_default) VALUES 
  ('11111111-1111-4111-8111-111111111111', 'Home', 'LOCATION', TRUE),
  ('22222222-2222-4222-8222-222222222222', 'Warehouse', 'LOCATION', TRUE),
  ('33333333-3333-4333-8333-333333333333', 'Van', 'LOCATION', TRUE);

-- 3. Create Items (V5 Features)
CREATE TABLE items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  item_type TEXT NOT NULL CHECK (item_type IN ('Tool', 'Part', 'Consumable')),
  is_asset BOOLEAN DEFAULT FALSE,
  
  -- Inventory
  quantity NUMERIC DEFAULT 0,
  
  -- UOM
  base_unit TEXT DEFAULT 'Ea',
  purchase_unit TEXT,
  conversion_rate INT DEFAULT 1,
  
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  low_stock_threshold INT DEFAULT NULL,
  image_url TEXT,
  
  -- Search
  tags TEXT[],
  brand TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Transactions
CREATE TABLE inventory_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  change_amount NUMERIC NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('RESTOCK', 'JOB_USAGE', 'LOSS', 'ADJUSTMENT', 'INITIAL_STOCK', 'PURCHASE', 'TRANSFER')),
  job_reference TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable RLS (and Fix Permissions)
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Allow Anon to do EVERYTHING (MVP Mode)
-- "WITH CHECK (true)" is critical for INSERTs to work!
CREATE POLICY "Public Access Locations" ON locations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Items" ON items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Transactions" ON inventory_transactions FOR ALL USING (true) WITH CHECK (true);

-- 6. Indexes
CREATE INDEX idx_items_name ON items USING GIN (to_tsvector('english', name));
