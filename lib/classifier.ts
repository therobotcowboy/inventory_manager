
import { ItemType } from "./types";

interface ClassificationResult {
    predictedType: ItemType;
    confidence: 'HIGH' | 'LOW';
    isAsset: boolean;
    defaultThreshold: number | null;
    defaultQuantity: number; // 0 for Parts/Consumables (to be filled), 1 for Tools
}

// Keywords for classification
const KEYWORDS = {
    TOOL: [
        'drill', 'saw', 'hammer', 'screwdriver', 'wrench', 'pliers', 'level', 'tape measure',
        'ladder', 'multimeter', 'tester', 'knife', 'cutter', 'crimper', 'stripper',
        'gun', 'driver', 'impact', 'sander', 'grinder', 'vacuum', 'vac', 'light', 'lamp',
        'extension cord', 'battery', 'charger', 'ladder', 'shovel', 'rake', 'broom', 'compressor'
    ],
    CONSUMABLE: [
        'screw', 'nail', 'bolt', 'nut', 'washer', 'anchor', 'fastener',
        'glue', 'adhesive', 'tape', 'caulk', 'sealant', 'epoxy',
        'wire nut', 'connector', 'zip tie', 'cable tie', 'staple',
        'sandpaper', 'disc', 'blade', 'bit', 'paint', 'stain', 'primer',
        'cleaner', 'rag', 'towel', 'glove', 'mask', 'filter'
    ],
    PART: [
        'outlet', 'switch', 'breaker', 'panel', 'fuse',
        'faucet', 'valve', 'pipe', 'fitting', 'elbow', 'coupling', 'tee', 'flange',
        'hinge', 'knob', 'handle', 'lock', 'latch',
        'bulb', 'fixture', 'thermostat', 'sensor', 'detector',
        'fan', 'motor', 'pump', 'board', 'wood', 'lumber', 'plywood', 'trim', 'molding'
    ]
};

export function classifyItem(name: string): ClassificationResult {
    const lowerName = name.toLowerCase();

    // 1. Check Tools (High Confidence)
    if (KEYWORDS.TOOL.some(k => lowerName.includes(k))) {
        return {
            predictedType: 'Tool',
            confidence: 'HIGH',
            isAsset: true,
            defaultThreshold: null, // No low stock for tools by default
            defaultQuantity: 1
        };
    }

    // 2. Check Consumables
    if (KEYWORDS.CONSUMABLE.some(k => lowerName.includes(k))) {
        return {
            predictedType: 'Consumable',
            confidence: 'HIGH',
            isAsset: false,
            defaultThreshold: 10, // Reasonable default
            defaultQuantity: 0
        };
    }

    // 3. Check Parts
    if (KEYWORDS.PART.some(k => lowerName.includes(k))) {
        return {
            predictedType: 'Part',
            confidence: 'HIGH',
            isAsset: false,
            defaultThreshold: 5,
            defaultQuantity: 0
        };
    }

    // 4. Ambiguous / Default
    // User requested "Default to Consumable" for ambiguous
    return {
        predictedType: 'Consumable',
        confidence: 'LOW',
        isAsset: false,
        defaultThreshold: 5,
        defaultQuantity: 0
    };
}
