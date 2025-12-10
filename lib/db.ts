import Dexie, { type EntityTable } from 'dexie';
import { Item, Location, AuditLog, ParsedVoiceCommand } from './types';

// We extend the types to include local properties if needed
interface OfflineAction {
    id: number;
    timestamp: string;
    type: 'SYNC_PUSH';
    payload: {
        table: 'items' | 'locations' | 'audit_logs';
        action: 'INSERT' | 'UPDATE' | 'DELETE';
        data: any;
    };
    synced: boolean;
}

const db = new Dexie('JoeInventoryDB') as Dexie & {
    items: EntityTable<Item, 'id'>;
    locations: EntityTable<Location, 'id'>;
    auditLogs: EntityTable<AuditLog, 'id'>;
    offlineQueue: EntityTable<OfflineAction, 'id'>;
};

// Schema definition
db.version(3).stores({
    items: 'id, name, location_id, category', // Index important fields
    locations: 'id, name, type, parent_id',
    auditLogs: 'id, item_id, action, timestamp',
    offlineQueue: '++id, timestamp, synced'
});

export { db };
export type { OfflineAction };
