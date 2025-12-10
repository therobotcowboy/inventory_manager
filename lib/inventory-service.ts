import { db } from './db';
import { ParsedVoiceCommand, Item } from './types';

export const InventoryService = {
    /**
     * explicit logic to handle "I added 50 screws"
     * 1. Find item by name (fuzzy match?) -> For now, exact match or simple includes
     * 2. Insert or Update
     * 3. Log Audit
     * 4. Queue Sync
     */
    async addItem(item: Omit<Item, 'id' | 'updated_at'>) {
        const timestamp = new Date().toISOString();
        const newItem: Item = {
            id: crypto.randomUUID(),
            updated_at: timestamp,
            ...item
        };

        await db.items.add(newItem);

        await db.offlineQueue.add({
            timestamp,
            type: 'SYNC_PUSH',
            synced: false,
            payload: {
                table: 'items',
                action: 'INSERT',
                data: newItem
            }
        });

        // Audit Log
        await this.logAudit(newItem.id, 'ADD_MANUAL', newItem.quantity, `Manual Add: ${newItem.name}`);
        return newItem;
    },

    async updateItem(id: string, updates: Partial<Item>) {
        const timestamp = new Date().toISOString();
        const item = await db.items.get(id);

        if (!item) throw new Error("Item not found");

        const updatedItem = { ...item, ...updates, updated_at: timestamp };
        await db.items.put(updatedItem);

        await db.offlineQueue.add({
            timestamp,
            type: 'SYNC_PUSH',
            synced: false,
            payload: {
                table: 'items',
                action: 'UPDATE',
                data: updatedItem
            }
        });

        // Audit Log if Quantity Changed
        if (updates.quantity !== undefined && updates.quantity !== item.quantity) {
            await this.logAudit(id, 'UPDATE_MANUAL', updates.quantity - item.quantity, `Manual Update: ${item.name}`);
        }

        return updatedItem;
    },

    async deleteItem(id: string) {
        const timestamp = new Date().toISOString();
        const item = await db.items.get(id);
        if (!item) return;

        await db.items.delete(id);

        await db.offlineQueue.add({
            timestamp,
            type: 'SYNC_PUSH',
            synced: false,
            payload: {
                table: 'items',
                action: 'DELETE', // Sync Engine needs to support this
                data: { id }
            }
        });

        await this.logAudit(id, 'DELETE_MANUAL', 0, `Deleted: ${item.name}`);
    },

    async logAudit(itemId: string, action: string, qtyChange: number, transcript: string) {
        const auditLog = {
            id: crypto.randomUUID(),
            item_id: itemId,
            action: action,
            quantity_change: qtyChange,
            voice_transcript: transcript,
            timestamp: new Date().toISOString()
        };

        await db.auditLogs.add(auditLog);
        await db.offlineQueue.add({
            timestamp: auditLog.timestamp,
            type: 'SYNC_PUSH',
            synced: false,
            payload: {
                table: 'audit_logs',
                action: 'INSERT',
                data: auditLog
            }
        });
    },

    async processCommand(command: ParsedVoiceCommand) {
        // ... (existing implementation, can be refactored to use above methods later)
        const timestamp = new Date().toISOString();

        const itemName = command.item_name.toLowerCase().trim();

        // 1. Find existing item
        // Simple search: filter by name. In a real app we'd want better search.
        const existingItems = await db.items
            .filter(i => i.name.toLowerCase() === itemName)
            .toArray();

        // For MVP, if multiple found, pick first. If none, create new.
        let targetItem: Item | undefined = existingItems[0];
        let isNew = false;

        // Logic branching
        if (command.action === 'ADD') {
            if (targetItem) {
                // Update
                targetItem.quantity += command.quantity;
                targetItem.updated_at = timestamp;
                await db.items.put(targetItem);

                // Queue Update
                await db.offlineQueue.add({
                    timestamp,
                    type: 'SYNC_PUSH',
                    synced: false,
                    payload: {
                        table: 'items',
                        action: 'UPDATE',
                        data: targetItem
                    }
                });

            } else {
                // Create
                isNew = true;
                targetItem = {
                    id: crypto.randomUUID(),
                    name: command.item_name, // keep original casing for display
                    quantity: command.quantity,
                    updated_at: timestamp,
                    location_id: undefined, // Default to null/van for now
                    low_stock_threshold: 10, // Default threshold
                    category: 'Uncategorized'
                };
                await db.items.add(targetItem);

                // Queue Insert
                await db.offlineQueue.add({
                    timestamp,
                    type: 'SYNC_PUSH',
                    synced: false,
                    payload: {
                        table: 'items',
                        action: 'INSERT',
                        data: targetItem
                    }
                });
            }
        } else if (command.action === 'REMOVE') {
            if (targetItem) {
                targetItem.quantity = Math.max(0, targetItem.quantity - command.quantity);
                targetItem.updated_at = timestamp;
                await db.items.put(targetItem);

                // Queue Update
                await db.offlineQueue.add({
                    timestamp,
                    type: 'SYNC_PUSH',
                    synced: false,
                    payload: {
                        table: 'items',
                        action: 'UPDATE',
                        data: targetItem
                    }
                });
            } else {
                // Trying to remove non-existent item? 
                // We can silently ignore or maybe create it with 0? 
                // For now, let's create a "Ghost" item with 0 so user knows we tried.
                isNew = true;
                targetItem = {
                    id: crypto.randomUUID(),
                    name: command.item_name,
                    quantity: 0,
                    updated_at: timestamp,
                    low_stock_threshold: 10,
                    category: 'Uncategorized'
                };
                await db.items.add(targetItem);

                // Queue Insert
                await db.offlineQueue.add({
                    timestamp,
                    type: 'SYNC_PUSH',
                    synced: false,
                    payload: {
                        table: 'items',
                        action: 'INSERT',
                        data: targetItem
                    }
                });
            }
        }

        // 2. Log to Audit (Local + Queue)
        // Ensure targetItem is defined
        if (targetItem && targetItem.id) {
            const auditLog = {
                id: crypto.randomUUID(),
                item_id: targetItem.id,
                action: command.action,
                quantity_change: command.quantity, // Log absolute value or delta? Schema says int. Let's stick to positive magnitude + action enum.
                voice_transcript: command.original_transcript,
                timestamp: timestamp
            };

            await db.auditLogs.add(auditLog);

            await db.offlineQueue.add({
                timestamp,
                type: 'SYNC_PUSH',
                synced: false,
                payload: {
                    table: 'audit_logs',
                    action: 'INSERT',
                    data: auditLog
                }
            });

            return { success: true, item: targetItem, isNew };
        }

        return { success: false };
    }
};
