
import { db, OfflineAction } from './db';
import { supabase } from './supabase';
import { liveQuery } from 'dexie';
import { toast } from 'sonner';

/**
 * PUSH: Watch the OfflineQueue and try to sync with Supabase
 */
export async function processOfflineQueue(): Promise<number> {
    // Use filter because boolean indexing can be tricky across Dexie versions
    const queue = await db.offlineQueue.filter(a => a.synced === false).toArray();

    if (queue.length === 0) return 0;

    for (const action of queue) {
        try {
            if (action.type === 'SYNC_PUSH') {
                const { table, action: dbAction, data } = action.payload;

                if (dbAction === 'INSERT') {
                    // Start Debug Logging
                    console.log(`[Sync] Inserting into ${table}:`, data);
                    const { error } = await supabase.from(table).insert(data);
                    if (error) {
                        console.error(`[Sync] Insert Error (${table}):`, error);
                        throw error;
                    }
                } else if (dbAction === 'UPDATE') {
                    console.log(`[Sync] Updating ${table}:${data.id}`, data);
                    const { error } = await supabase.from(table).update(data).eq('id', data.id);
                    if (error) {
                        console.error(`[Sync] Update Error (${table}):`, error);
                        throw error;
                    }
                } else if (dbAction === 'DELETE') {
                    console.log(`[Sync] Deleting from ${table}:${data.id}`);
                    const { error } = await supabase.from(table).delete().eq('id', data.id);
                    if (error) {
                        console.error(`[Sync] Delete Error (${table}):`, error);
                        throw error;
                    }
                }
            }

            // Mark as synced
            await db.offlineQueue.update(action.id, { synced: true });
            toast.success("Synced to Cloud");

        } catch (error) {
            console.error("Sync Error for action", action.id, error);
            toast.error(`Sync Failed: ${(error as any).message || 'Unknown error'}`);
        }
    }
    return queue.length;
}

/**
 * PULL: Fetch latest data from Supabase and replace/update local cache
 * This is a 'dumb' full sync for MVP. Optimizations: incremental sync via 'updated_at'
 */
export async function syncPull() {
    try {
        // 1. Locations
        const { data: locations, error: locError } = await supabase.from('locations').select('*');
        if (locError) throw locError;
        if (locations) {
            await db.locations.bulkPut(locations);
        }

        // 2. Items
        const { data: items, error: itemError } = await supabase.from('items').select('*');
        if (itemError) throw itemError;
        if (items) {
            await db.items.bulkPut(items);
        }

        console.log("Sync Pull Complete");

    } catch (error) {
        console.error("Sync Pull Failed", error);
    }
}

/**
 * Hook to auto-sync when online
 */
// In a real app we'd use `window.addEventListener('online')` etc.
