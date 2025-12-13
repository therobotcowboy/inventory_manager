import Dexie, { type EntityTable } from 'dexie';
import { Item, Location, InventoryTransaction, ParsedVoiceCommand } from './types';

// We extend the types to include local properties if needed
interface OfflineAction {
    id: number;
    timestamp: string;
    type: 'SYNC_PUSH';
    payload: {
        table: 'items' | 'locations' | 'audit_logs' | 'inventory_transactions';
        action: 'INSERT' | 'UPDATE' | 'DELETE';
        data: any;
    };
    synced: boolean;
}

const db = new Dexie('JoeInventoryDB') as Dexie & {
    items: EntityTable<Item, 'id'>;
    locations: EntityTable<Location, 'id'>;
    inventoryTransactions: EntityTable<InventoryTransaction, 'id'>;
    offlineQueue: EntityTable<OfflineAction, 'id'>;
};

// Schema definition
db.version(5).stores({
    items: 'id, name, location_id, item_type, is_asset, *tags, brand', // Added new search indexes
    locations: 'id, name, type, parent_id',
    inventoryTransactions: 'id, item_id, transaction_type, job_reference, timestamp', // New table
    offlineQueue: '++id, timestamp, synced'
});

export { db };
export type { OfflineAction };

export async function seedDatabase() {
    // Check if empty
    const count = await db.locations.count();
    if (count === 0) {
        console.log("Seeding Local Database...");
        await db.locations.bulkAdd([
            { id: '11111111-1111-4111-8111-111111111111', name: 'Home', type: 'LOCATION', is_system_default: true },
            { id: '22222222-2222-4222-8222-222222222222', name: 'Warehouse', type: 'LOCATION', is_system_default: true },
            { id: '33333333-3333-4333-8333-333333333333', name: 'Van', type: 'LOCATION', is_system_default: true },
        ]);
        console.log("Seeding Complete.");
    }
}
