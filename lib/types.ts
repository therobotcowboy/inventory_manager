export type ItemType = 'Tool' | 'Part' | 'Consumable';
export type UnitOfMeasure = 'Ea' | 'Box' | 'Roll' | 'Gal' | 'Ft' | 'Lb';
export type LocationType = 'Vehicle' | 'Warehouse' | 'Bin' | 'ToolBag' | 'JobSite';

export interface InventoryItem {
  id: string; // UUID
  name: string;
  description?: string;
  model_number?: string;
  type: ItemType;
  unit_of_measure: UnitOfMeasure;
  min_qty_alert: number;
  image_url?: string;
  // In a real relational DB, qty is in a tracking table. 
  // For the App State/Offline View, we often denormalize "current qty" here 
  // or store it in a separate linked object. 
  // We'll keep it simple for the MVP interface:
  current_qty: number;
  location_id: string;
  updated_at: string;
}

export interface InventoryLocation {
  id: string;
  name: string;
  type: LocationType;
  parent_id?: string;
}

export interface JobRecommendation {
  id: string;
  job_name: string;
  required_items: {
    item_name: string;
    qty_needed: number;
    // We might match this to an inventory ID if known
    inventory_id?: string;
  }[];
}

export interface ParsedVoiceCommand {
  action: 'ADD' | 'REMOVE' | 'MOVE' | 'CHECK';
  item_name: string;
  quantity: number;
  source_location?: string;
  destination_location?: string;
  confidence: number;
  original_transcript?: string;
}

export interface Location {
  id: string; // UUID
  name: string;
  type: 'VAN' | 'SHELF' | 'BIN' | 'JOB_SITE';
  parent_id?: string;
}

export interface Item {
  id: string; // UUID
  name: string;
  quantity: number;
  location_id?: string;
  category?: string;
  low_stock_threshold: number;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  item_id?: string;
  action: string;
  quantity_change?: number;
  voice_transcript?: string;
  timestamp: string;
}

// Check lib/db.ts for Dexie specific types
