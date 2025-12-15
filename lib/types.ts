export type ItemType = 'Tool' | 'Part' | 'Consumable';
export type UnitOfMeasure = 'Ea' | 'Box' | 'Roll' | 'Gal' | 'Ft' | 'Lb';
export type LocationType = 'ROOT' | 'LOCATION' | 'AREA' | 'CONTAINER';

export interface Location {
  id: string; // UUID
  name: string;
  type: LocationType;
  parent_id?: string;
  is_system_default?: boolean;
}


export interface Item {
  id: string; // UUID
  name: string;
  description?: string;
  item_type: ItemType;
  is_asset?: boolean; // New in V5

  quantity: number;

  // UOM Logic (New V5)
  base_unit: string; // Defaults to 'Ea'
  purchase_unit?: string;
  conversion_rate?: number; // Defaults to 1

  location_id?: string; // Should reference a Container or Area
  low_stock_threshold?: number | null; // Only for Parts/Consumables
  image_url?: string;

  // Search
  tags?: string[];
  brand?: string;

  updated_at: string;
}

export type TransactionType = 'RESTOCK' | 'JOB_USAGE' | 'LOSS' | 'ADJUSTMENT' | 'INITIAL_STOCK' | 'PURCHASE' | 'TRANSFER';

export interface InventoryTransaction {
  id: string;
  item_id?: string;
  change_amount: number;
  transaction_type: TransactionType;
  job_reference?: string;
  timestamp: string;
}
// Alias for backward compatibility if needed, or just replace
export type AuditLog = InventoryTransaction;


// Deprecated or Legacy interfaces - consolidate if possible
// For now, removing `InventoryItem` and `InventoryLocation` in favor of the cleaner `Item` and `Location` above
// or aliasing them if codebase heavily uses them.
export type InventoryItem = Item;
export type InventoryLocation = Location;

export interface JobRecommendation {
  id: string;
  job_name: string;
  required_items: {
    item_name: string;
    qty_needed: number;
    inventory_id?: string;
  }[];
}

// Voice
export type VoiceCommandType = 'ADD' | 'REMOVE' | 'QUERY' | 'MOVE';

export interface ParsedVoiceCommand {
  type: VoiceCommandType;
  item: string;
  quantity?: number;
  unit?: string; // New: e.g. "Box", "Pack"
  location?: string; // For ADD/QUERY (Target location)
  fromLocation?: string; // For MOVE (Source)
  toLocation?: string; // For MOVE (Destination)
  job_reference?: string; // New: e.g. "Smith House"

  // Ambiguity / Chat Flow
  requires_clarification?: boolean;
  clarification_question?: string; // "Did you mean Wood or Drywall screws?"

  originalTranscript: string;
  confidence: number;
}

export interface ParsedCommandResult {
  commands: ParsedVoiceCommand[];
}





// Check lib/db.ts for Dexie specific types
