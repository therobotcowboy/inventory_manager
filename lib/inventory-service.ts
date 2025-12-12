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

    async resolveLocation(name?: string): Promise<string | undefined> {
        if (!name) return undefined;

        const normalize = (str: string) => {
            return str.toLowerCase()
                .replace(/\bone\b/g, '1')
                .replace(/\btwo\b/g, '2')
                .replace(/\bthree\b/g, '3')
                .replace(/\bfour\b/g, '4')
                .replace(/\bfive\b/g, '5')
                // Remove punctuation/symbols for looser match
                .replace(/[^a-z0-9 ]/g, '')
                .trim();
        };

        const search = normalize(name);
        const allLocs = await db.locations.toArray();

        // 1. Exact match on normalized fields
        let match = allLocs.find(l => normalize(l.name) === search);

        // 2. Contains match (e.g. "Van 1" inside "Main Van 1")
        if (!match) {
            match = allLocs.find(l => normalize(l.name).includes(search) || search.includes(normalize(l.name)));
        }

        return match?.id;
    },

    async moveItem(itemName: string, quantity: number, fromLocName?: string, toLocName?: string, transcript: string = "") {
        const fromLocId = await this.resolveLocation(fromLocName);
        const toLocId = await this.resolveLocation(toLocName);
        const timestamp = new Date().toISOString();

        // 1. Identify Source Item
        let sourceItem: Item | undefined;
        if (fromLocId) {
            // Precise query
            const candidates = await db.items
                .where('location_id').equals(fromLocId)
                .filter(i => i.name.toLowerCase() === itemName.toLowerCase())
                .toArray();
            sourceItem = candidates[0];
        } else {
            // Loose query (find first occurrence anywhere)
            const candidates = await db.items
                .filter(i => i.name.toLowerCase() === itemName.toLowerCase())
                .toArray();
            sourceItem = candidates[0];
        }

        if (!sourceItem) {
            throw new Error(`Item ${itemName} not found${fromLocName ? ` in ${fromLocName}` : ''}`);
        }

        if (sourceItem.quantity < quantity) {
            throw new Error(`Not enough quantity: Has ${sourceItem.quantity}, trying to move ${quantity}`);
        }

        // 2. Identify/Create Dest Item
        let destItem: Item | undefined;
        if (toLocId) {
            const candidates = await db.items
                .where('location_id').equals(toLocId)
                .filter(i => i.name.toLowerCase() === itemName.toLowerCase())
                .toArray();
            destItem = candidates[0];
        } else {
            // Moving to unknown location? If toLocName is missing. 
            // If they just say "Move drill", maybe they mean "Remove"?
            // But if type is MOVE, we expect a destination logic unless we fallback to "Unassigned" (null).
            // Let's assume toLocId = null (Unassigned) if not found, OR just create new unassigned item.
            const candidates = await db.items
                .filter(i => i.name.toLowerCase() === itemName.toLowerCase() && !i.location_id)
                .toArray();
            destItem = candidates[0];
        }

        // Transaction manually
        // Decrement Source
        await this.updateItem(sourceItem.id, { quantity: sourceItem.quantity - quantity });

        // Increment Dest
        if (destItem) {
            await this.updateItem(destItem.id, { quantity: destItem.quantity + quantity });
        } else {
            // Create new at dest
            const newItem: Item = {
                id: crypto.randomUUID(),
                name: sourceItem.name, // Correct casing
                quantity: quantity,
                updated_at: timestamp,
                location_id: toLocId, // could be undefined
                low_stock_threshold: sourceItem.low_stock_threshold,
                category: sourceItem.category
            };
            await db.items.add(newItem);
            await db.offlineQueue.add({
                timestamp, type: 'SYNC_PUSH', synced: false,
                payload: { table: 'items', action: 'INSERT', data: newItem }
            });
            await this.logAudit(newItem.id, 'MOVE_IN', quantity, transcript);
            destItem = newItem;
        }

        await this.logAudit(sourceItem.id, 'MOVE_OUT', quantity, transcript);

        return { success: true, movedItem: destItem };
    },

    async processCommand(command: ParsedVoiceCommand) {
        const timestamp = new Date().toISOString();
        const itemName = command.item.toLowerCase().trim();

        if (command.type === 'MOVE') {
            try {
                return await this.moveItem(
                    itemName,
                    command.quantity || 1,
                    command.fromLocation,
                    command.toLocation,
                    command.originalTranscript
                );
            } catch (e: any) {
                console.error("Move Failed", e);
                // Fallback? Or just throw so UI shows error?
                // Throwing allows VoiceAgent to show toast error
                throw e;
            }
        }

        // Logic branching for ADD / REMOVE
        // Resolving location logic for ADD (Feature A preparation)
        const targetLocId = await this.resolveLocation(command.location);

        // Find existing item (fuzzy or specific to location if we implement Feature A fully)
        // For now, if location specified, try find there first.
        let targetItem: Item | undefined;
        let candidates;

        if (targetLocId) {
            candidates = await db.items
                .where('location_id').equals(targetLocId)
                .filter(i => i.name.toLowerCase() === itemName)
                .toArray();
        } else {
            candidates = await db.items
                .filter(i => i.name.toLowerCase() === itemName)
                .toArray();
        }
        targetItem = candidates[0];

        let isNew = false;

        if (command.type === 'ADD') {
            if (targetItem) {
                // Update
                targetItem.quantity += (command.quantity || 1);
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
                    name: command.item, // keep original casing
                    quantity: command.quantity || 1,
                    updated_at: timestamp,
                    location_id: targetLocId, // Feature A: Assign location if parsed
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
        } else if (command.type === 'REMOVE') {
            if (targetItem) {
                targetItem.quantity = Math.max(0, targetItem.quantity - (command.quantity || 1));
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
                // Remove non-existent?
                isNew = true;
                targetItem = {
                    id: crypto.randomUUID(),
                    name: command.item,
                    quantity: 0,
                    updated_at: timestamp,
                    low_stock_threshold: 10,
                    category: 'Uncategorized',
                    location_id: targetLocId
                };
                await db.items.add(targetItem);
                await db.offlineQueue.add({
                    timestamp, type: 'SYNC_PUSH', synced: false,
                    payload: { table: 'items', action: 'INSERT', data: targetItem }
                });
            }
        }

        // 2. Log to Audit (Local + Queue)
        if (targetItem && targetItem.id) {
            const auditLog = {
                id: crypto.randomUUID(),
                item_id: targetItem.id,
                action: command.type,
                quantity_change: command.quantity,
                voice_transcript: command.originalTranscript,
                timestamp: timestamp
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

            return { success: true, item: targetItem, isNew };
        }

        return { success: false };
    }
};
