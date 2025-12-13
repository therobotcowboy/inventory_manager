-- SPRINT 5: Advanced Logic (Assets, UOM, Transactions)
-- Replaces/Upgrades V4 Schema

-- 1. Modify Items Table
-- We add columns instead of dropping to preserve basic structure, 
-- though likely we are wiping anyway given the drastic logic change.
-- Let's assume a wipe for safety and clean state as requested.

DROP TABLE IF EXISTS inventory_transactions CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;

-- 1. Create Locations Table (From V4 Hierarchy)
CREATE TABLE locations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ROOT', 'LOCATION', 'AREA', 'CONTAINER')), 
  parent_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  is_system_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Roots immediately to prevent FK errors when adding items to them
INSERT INTO locations (id, name, type, is_system_default) VALUES 
  ('11111111-1111-4111-8111-111111111111', 'Home', 'LOCATION', TRUE),
  ('22222222-2222-4222-8222-222222222222', 'Workshop', 'LOCATION', TRUE),
  ('33333333-3333-4333-8333-333333333333', 'Van', 'LOCATION', TRUE);

-- 2. Re-create Items with new fields (V5)
CREATE TABLE items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  item_type TEXT NOT NULL CHECK (item_type IN ('Tool', 'Part', 'Consumable')),
  is_asset BOOLEAN DEFAULT FALSE, -- Derived from Tool usually, but explicit field allows flexibility
  
  -- Inventory Handling
  quantity NUMERIC DEFAULT 0, -- Changed to numeric for potential fractional units (e.g. 1.5 Gal)
  
  -- Unit of Measure
  base_unit TEXT DEFAULT 'Ea', -- The unit the quantity represents (e.g. 'Screw', 'mL')
  purchase_unit TEXT, -- e.g. 'Box', 'Pack'
  conversion_rate INT DEFAULT 1, -- How many Base Units in a Purchase Unit
  
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  low_stock_threshold INT DEFAULT NULL,
  image_url TEXT,
  
  -- Search Optimization
  tags TEXT[], -- Array of tags for search
  brand TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Transactions Table
CREATE TABLE inventory_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  change_amount NUMERIC NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('RESTOCK', 'JOB_USAGE', 'LOSS', 'ADJUSTMENT', 'INITIAL_STOCK', 'PURCHASE')),
  job_reference TEXT, -- Nullable, e.g. "Smith Job"
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Access" ON items FOR ALL USING (true);
CREATE POLICY "Public Access" ON inventory_transactions FOR ALL USING (true);

-- 4. Indexes for Search Optimization
CREATE INDEX idx_items_name ON items USING GIN (to_tsvector('english', name));
CREATE INDEX idx_items_brand ON items (brand);
-- CREATE INDEX idx_items_tags ON items USING GIN (tags); -- Standard PG Array support

-- 5. Helper Views? (Optional, skipping for MVP)
