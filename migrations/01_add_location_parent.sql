-- Add parent_id to locations for hierarchy
ALTER TABLE locations ADD COLUMN parent_id UUID REFERENCES locations(id);

-- Policy remains enabling all for now, but this column is safe.
