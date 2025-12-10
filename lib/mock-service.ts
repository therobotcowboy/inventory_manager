import { InventoryItem, InventoryLocation, JobRecommendation, ParsedVoiceCommand } from './types';

// --- MOCK DATA ---

const MOCK_LOCATIONS: InventoryLocation[] = [
    { id: 'loc-1', name: 'Van 1', type: 'Vehicle' },
    { id: 'loc-2', name: 'Van 1 - Drawer A (Screws)', type: 'Bin', parent_id: 'loc-1' },
    { id: 'loc-3', name: 'Warehouse Main', type: 'Warehouse' },
    { id: 'loc-4', name: 'Job Site: 123 Main St', type: 'JobSite' },
];

const MOCK_ITEMS: InventoryItem[] = [
    {
        id: 'item-1',
        name: 'DeWalt 3-inch Deck Screws',
        type: 'Consumable',
        unit_of_measure: 'Box',
        min_qty_alert: 2,
        current_qty: 5,
        location_id: 'loc-2',
        updated_at: new Date().toISOString()
    },
    {
        id: 'item-2',
        name: 'Wire Nuts (Red)',
        type: 'Part',
        unit_of_measure: 'Box',
        min_qty_alert: 1,
        current_qty: 0.5,
        location_id: 'loc-1',
        updated_at: new Date().toISOString()
    },
    {
        id: 'item-3',
        name: 'Impact Driver',
        type: 'Tool',
        unit_of_measure: 'Ea',
        min_qty_alert: 1,
        current_qty: 1,
        location_id: 'loc-1',
        updated_at: new Date().toISOString()
    },
];

// --- MOCK SERVICES ---

export const MockInventoryService = {
    getLocations: async (): Promise<InventoryLocation[]> => {
        return new Promise((resolve) => setTimeout(() => resolve(MOCK_LOCATIONS), 500));
    },

    getItems: async (): Promise<InventoryItem[]> => {
        return new Promise((resolve) => setTimeout(() => resolve(MOCK_ITEMS), 500));
    },

    // Simulate an update
    updateItemQty: async (itemId: string, newQty: number): Promise<void> => {
        console.log(`[MockDB] Updating ${itemId} to qty ${newQty}`);
        return new Promise((resolve) => setTimeout(resolve, 300));
    }
};

export const MockAiService = {
    parseVoiceCommand: async (transcript: string): Promise<ParsedVoiceCommand> => {
        console.log(`[MockAI] Parsing: "${transcript}"`);
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API latency

        // Simple heuristic parser for demo
        const lower = transcript.toLowerCase();
        let action: ParsedVoiceCommand['action'] = 'CHECK';
        let qty = 1;

        if (lower.includes('add') || lower.includes('bought') || lower.includes('got')) action = 'ADD';
        if (lower.includes('use') || lower.includes('took') || lower.includes('remove')) action = 'REMOVE';
        if (lower.includes('move') || lower.includes('put')) action = 'MOVE';

        // Extract number (very basic)
        const numberMatch = lower.match(/\d+/);
        if (numberMatch) qty = parseInt(numberMatch[0], 10);

        return {
            action,
            item_name: 'Unknown Item (Mock Parsed)', // In real app, Gemini extracts this
            quantity: qty,
            original_transcript: transcript,
            confidence: 0.85
        };
    },

    getJobRecommendations: async (query: string): Promise<JobRecommendation> => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return {
            id: 'job-rec-1',
            job_name: query,
            required_items: [
                { item_name: 'Wire Nuts', qty_needed: 2 },
                { item_name: 'Electrical Tape', qty_needed: 1 },
                { item_name: 'DeWalt Impact Driver', qty_needed: 1 }
            ]
        };
    }
};
