-- DANGER: This script wipes all data to enforce the new hierarchy.
-- SPRINT 4: Schema Refactor

-- 1. Drop existing tables
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS locations CASCADE;

-- 2. Create Locations Table with Hierarchy
-- Types: 'ROOT' (The invisible top level if needed, or just use Location), 'LOCATION' (Home, Van), 'AREA' (Shelf), 'CONTAINER' (Bin)
CREATE TABLE locations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ROOT', 'LOCATION', 'AREA', 'CONTAINER')), 
  parent_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  is_system_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Items Table
CREATE TABLE items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  item_type TEXT NOT NULL CHECK (item_type IN ('Tool', 'Part', 'Consumable')),
  quantity INT DEFAULT 0,
  unit_of_measure TEXT DEFAULT 'Ea',
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL, -- Must be in a Container or Area
  low_stock_threshold INT DEFAULT NULL, -- Only for Parts/Consumables
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Audit Logs
CREATE TABLE audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  quantity_change INT,
  voice_transcript TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 5. RLS Policies
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Access" ON locations FOR ALL USING (true);
CREATE POLICY "Public Access" ON items FOR ALL USING (true);
CREATE POLICY "Public Access" ON audit_logs FOR ALL USING (true);

-- 6. Seed Data (Top Level Locations)
-- 6. Seed Data (Top Level Locations)
INSERT INTO locations (id, name, type, is_system_default) VALUES 
  ('11111111-1111-4111-8111-111111111111', 'Home', 'LOCATION', TRUE),
  ('22222222-2222-4222-8222-222222222222', 'Workshop', 'LOCATION', TRUE),
  ('33333333-3333-4333-8333-333333333333', 'Van', 'LOCATION', TRUE);
