import { db } from './db';
import { ParsedVoiceCommand, Item, Location, InventoryTransaction, TransactionType } from './types';

export const InventoryService = {
    /**
     * V5: Advanced Add Logic (Assets + UOM + Transactions)
     */
    async addItem(item: Omit<Item, 'id' | 'updated_at'>) {
        const timestamp = new Date().toISOString();

        // 1. Asset Enforcement: If 'Tool', force Qty=1.
        // If user tries to add Quantity 5 of a Tool, we ideally loop? 
        // For MVP, if it IS a tool, we force quantity 1.
        // BETTER: If IsAsset, we just treat the input quantity as 1 (or throw error? User plan said "Auto-split or Error". Let's assume single addition for now).
        // Actually, if we get "5 Drills", we loop 5 times? 
        // Let's stick to the Simplest Logic: If Asset, Quantity is ALWAYS 1.

        let finalQty = item.quantity;
        let finalType = item.item_type;
        let isAsset = item.is_asset || (item.item_type === 'Tool'); // Infer asset status

        if (isAsset) {
            finalQty = 1;
        }

        // 2. UOM Logic: Conversion
        // If user provided a quantity but the item has a conversion rate context (usually handled in UI before service call, but here for safety)
        // Service expects 'quantity' to be in BASE UNITS already unless we add specific UOM params. 
        // We assume Caller (UI) handles "1 Box" -> "100 Screws".
        // BUT, for Voice Commands, we might need logic here. 
        // For standard `addItem`, we trust the input `quantity` is the Base Unit amount.

        const newItem: Item = {
            id: crypto.randomUUID(),
            updated_at: timestamp,
            ...item,
            quantity: finalQty, // Enforced
            is_asset: isAsset,
            base_unit: item.base_unit || 'Ea',
            conversion_rate: item.conversion_rate || 1
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

        // Transaction Log
        await this.logTransaction(newItem.id, 'INITIAL_STOCK', finalQty, `Added: ${newItem.name}`);
        return newItem;
    },

    async updateItem(id: string, updates: Partial<Item>) {
        const timestamp = new Date().toISOString();
        const item = await db.items.get(id);

        if (!item) throw new Error("Item not found");

        // Asset Protection: Cannot increase quantity > 1 for Assets
        if (item.is_asset && updates.quantity !== undefined && updates.quantity > 1) {
            // If they try to set it to > 1, cap at 1.
            updates.quantity = 1;
        }

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

        // Transaction Log if Quantity Changed
        if (updates.quantity !== undefined && updates.quantity !== item.quantity) {
            const diff = updates.quantity - item.quantity;
            const type: TransactionType = diff > 0 ? 'RESTOCK' : 'JOB_USAGE'; // Guessing type
            await this.logTransaction(id, type, diff, `Updated: ${item.name}`);
        }

        return updatedItem;
    },

    async deleteItem(id: string) {
        const timestamp = new Date().toISOString();
        const item = await db.items.get(id);
        if (!item) return;

        // Log transaction BEFORE deleting, so item exists for FK
        await this.logTransaction(id, 'LOSS', -item.quantity, `Deleted: ${item.name}`);

        await db.items.delete(id);

        await db.offlineQueue.add({
            timestamp,
            type: 'SYNC_PUSH',
            synced: false,
            payload: {
                table: 'items',
                action: 'DELETE',
                data: { id }
            }
        });
    },

    async deleteLocation(id: string) {
        const timestamp = new Date().toISOString();
        const loc = await db.locations.get(id);
        if (!loc) return;

        // Check for children
        const children = await db.locations.where('parent_id').equals(id).count();
        const items = await db.items.where('location_id').equals(id).count();

        if (children > 0 || items > 0) {
            throw new Error(`Cannot delete location. It contains ${children} sub-locations and ${items} items.`);
        }

        await db.locations.delete(id);

        await db.offlineQueue.add({
            timestamp,
            type: 'SYNC_PUSH',
            synced: false,
            payload: {
                table: 'locations',
                action: 'DELETE',
                data: { id }
            }
        });
    },

    async logTransaction(itemId: string, type: TransactionType, qtyChange: number, jobRef?: string) {
        const txn: InventoryTransaction = {
            id: crypto.randomUUID(),
            item_id: itemId,
            transaction_type: type,
            change_amount: qtyChange,
            job_reference: jobRef,
            timestamp: new Date().toISOString()
        };

        await db.inventoryTransactions.add(txn); // Use new table

        await db.offlineQueue.add({
            timestamp: txn.timestamp,
            type: 'SYNC_PUSH',
            synced: false,
            payload: {
                table: 'inventory_transactions', // New table name
                action: 'INSERT',
                data: txn
            }
        });
    },

    async resolveLocation(name?: string): Promise<string | undefined> {
        if (!name) return undefined;
        const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        const search = normalize(name);
        const allLocs = await db.locations.toArray();
        let match = allLocs.find(l => normalize(l.name) === search);
        if (!match) {
            match = allLocs.find(l => normalize(l.name).includes(search) || search.includes(normalize(l.name)));
        }
        return match?.id;
    },

    async moveItem(itemName: string, quantity: number, fromLocName?: string, toLocName?: string, transcript: string = "") {
        const timestamp = new Date().toISOString();
        console.warn(`[Move] Parse: "${transcript || `Move ${itemName} to ${toLocName}`}"`);

        // 1. Resolve Item
        console.warn(`[Move] Search: querying DB for name ilike %${itemName}%`);
        const allItems = await db.items.toArray();
        const normalize = (s: string) => s.toLowerCase().trim();
        const query = normalize(itemName);

        let matches = allItems.filter(i => normalize(i.name) === query); // Exact
        if (matches.length === 0) {
            matches = allItems.filter(i => normalize(i.name).includes(query)); // Partial
        }

        console.warn(`[Move] Result: Found ${matches.length} records.`);

        if (matches.length === 0) {
            console.error(`[Move] Error: Item "${itemName}" not found.`);
            throw new Error(`Item "${itemName}" not found.`);
        }

        if (matches.length > 1) {
            console.error(`[Move] Error: Ambiguous match for "${itemName}". Found: ${matches.map(m => m.name).join(", ")}`);
            throw new Error(`Ambiguous item "${itemName}". Please be more specific.`);
        }

        const item = matches[0];
        console.warn(`[Move] PROCEED with Item ID: ${item.id} (${item.name})`);

        // 2. Resolve Target Location
        if (!toLocName) {
            throw new Error("Target location is required for Move.");
        }

        console.warn(`[Move] Resolving Location: "${toLocName}"`);
        // Use ensureLocationPath to handle "Van > Shelf A"
        const toLocId = await this.ensureLocationPath(toLocName);
        console.warn(`[Move] Resolved Location ID: ${toLocId}`);

        // 3. Execution
        // If FromLocation specified, validate? (Skipping strict from-check for now to be forgiving)

        await this.updateItem(item.id, { location_id: toLocId });
        console.warn(`[Move] Updated item location to ${toLocId}`);

        // 4. Log Transaction
        await this.logTransaction(item.id, 'TRANSFER', 0, `Moved to ${toLocName}`);

        return { success: true, item, isNew: false };
    },

    /**
     * Helper to calculate quantity based on Unit of Measure
     */
    getConvertedQuantity(item: Item | undefined, quantity: number, unit?: string): number {
        if (!item || !unit || !item.purchase_unit) return quantity;

        // Simple fuzzy check: "Box" == "Box" or "Boxes"
        const normalize = (s: string) => s.toLowerCase().replace(/s$/, '');
        if (normalize(unit) === normalize(item.purchase_unit)) {
            return quantity * (item.conversion_rate || 1);
        }
        return quantity;
    },

    /**
     * Helper to resolve or create a location path "Parent > Child"
     */
    async ensureLocationPath(pathStr: string): Promise<string> {
        const parts = pathStr.split('>').map(s => s.trim()).filter(s => s);
        if (parts.length === 0) throw new Error("Invalid location path");

        let parentId: string | undefined = undefined;

        for (const locName of parts) {
            const allLocs = await db.locations.toArray();
            let match = allLocs.find(l =>
                l.name.toLowerCase() === locName.toLowerCase() &&
                l.parent_id === ((parentId === undefined) ? null : parentId)
            );

            if (!match) {
                const newLoc: Location = {
                    id: crypto.randomUUID(),
                    name: locName,
                    type: parentId ? 'CONTAINER' : 'AREA',
                    parent_id: parentId || undefined // db types say optional, schema says parent_id
                };
                // Force cast if lint complains about id presence/absence logic in Dexie types
                await db.locations.add(newLoc);
                await db.offlineQueue.add({
                    timestamp: new Date().toISOString(), type: 'SYNC_PUSH', synced: false,
                    payload: { table: 'locations', action: 'INSERT', data: newLoc }
                });
                match = newLoc;
            }
            parentId = match.id;
        }
        return parentId!;
    },

    async processCommand(command: ParsedVoiceCommand) {
        const timestamp = new Date().toISOString();
        const itemName = command.item.toLowerCase().trim();
        const jobRef = command.job_reference;

        // MOVE Logic
        if (command.type === 'MOVE') {
            return await this.moveItem(itemName, command.quantity || 1, command.fromLocation, command.toLocation, command.originalTranscript);
        }

        const actionType: TransactionType = command.type === 'ADD' ? 'RESTOCK' : 'JOB_USAGE';

        const allItems = await db.items.toArray();
        let targetItem = allItems.find(i => i.name.toLowerCase() === itemName);

        let finalQty = command.quantity || 1;
        let isNew = false;
        let targetLocId: string | undefined = undefined;

        if (!targetItem) {
            if (command.type === 'REMOVE') return { success: false, message: "Item not found" };

            // Resolve Location (Path or Single)
            if (command.location) {
                targetLocId = await this.ensureLocationPath(command.location);
            } else {
                targetLocId = await this.resolveLocation('Workshop');
            }

            isNew = true;
            targetItem = {
                id: crypto.randomUUID(),
                name: command.item,
                quantity: 0,
                updated_at: timestamp,
                low_stock_threshold: 10,
                item_type: 'Part',
                base_unit: 'Ea',
                location_id: targetLocId
            };
            await db.items.add(targetItem);
            await db.offlineQueue.add({
                timestamp, type: 'SYNC_PUSH', synced: false,
                payload: { table: 'items', action: 'INSERT', data: targetItem }
            });
        }

        // UOM Conversion
        if (targetItem && command.unit) {
            finalQty = this.getConvertedQuantity(targetItem, finalQty, command.unit);
        }

        // Calculate New Quantity
        let newQuantity = command.type === 'ADD' ? (targetItem.quantity + finalQty) : (targetItem.quantity - finalQty);

        // Asset Protection
        if (targetItem.is_asset) {
            if (command.type === 'ADD') newQuantity = 1;
            if (command.type === 'REMOVE') newQuantity = 0;
        }
        newQuantity = Math.max(0, newQuantity);

        // Persist Update
        await this.updateItem(targetItem.id, { quantity: newQuantity });

        // Log Transaction
        const change = command.type === 'REMOVE' ? -finalQty : finalQty;
        await this.logTransaction(targetItem.id, actionType, change, jobRef);

        return { success: true, item: targetItem, isNew };
    },
};
