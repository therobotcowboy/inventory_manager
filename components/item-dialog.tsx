"use client"

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InventoryService } from '@/lib/inventory-service';
import { Item } from '@/lib/types';
import { toast } from 'sonner';
import { SmartError } from '@/components/ui/smart-error';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Loader2 } from 'lucide-react';
import { processOfflineQueue } from '@/lib/sync-engine';

interface ItemDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialItem?: Item | null; // If null, we are adding new
    defaultLocationId?: string;
}

export function ItemDialog({ open, onOpenChange, initialItem, defaultLocationId }: ItemDialogProps) {
    const [name, setName] = useState('');
    const [quantity, setQuantity] = useState(0);
    const [itemType, setItemType] = useState<Item['item_type']>('Part');
    const [lowStockThreshold, setLowStockThreshold] = useState<number>(5);
    const [baseUnit, setBaseUnit] = useState('Ea');
    const [purchaseUnit, setPurchaseUnit] = useState('');
    const [conversionRate, setConversionRate] = useState(1);
    const [locationId, setLocationId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Fetch locations
    const locations = useLiveQuery(() => db.locations.toArray());

    // Reset form when dialog opens/closes or initialItem changes
    useEffect(() => {
        if (open) {
            if (initialItem) {
                setName(initialItem.name);
                setQuantity(initialItem.quantity);
                setItemType(initialItem.item_type || 'Part');
                setLowStockThreshold(initialItem.low_stock_threshold || 5);
                setBaseUnit(initialItem.base_unit || 'Ea');
                setPurchaseUnit(initialItem.purchase_unit || '');
                setConversionRate(initialItem.conversion_rate || 1);
                setLocationId(initialItem.location_id || null);
            } else {
                setName('');
                setQuantity(0);
                setItemType('Part');
                setLowStockThreshold(5);
                setBaseUnit('Ea');
                setPurchaseUnit('');
                setConversionRate(1);
                setLocationId(defaultLocationId || null);
            }
        }
    }, [open, initialItem, defaultLocationId]);

    const handleSave = async () => {
        if (!name.trim()) {
            toast.warning("Name is required");
            return;
        }

        setLoading(true);
        try {
            if (initialItem) {
                // Edit
                await InventoryService.updateItem(initialItem.id, {
                    name: name.trim(),
                    quantity: Number(quantity),
                    item_type: itemType,
                    low_stock_threshold: (itemType === 'Part' || itemType === 'Consumable') ? lowStockThreshold : undefined,
                    location_id: locationId || undefined,
                    base_unit: baseUnit,
                    purchase_unit: purchaseUnit,
                    conversion_rate: conversionRate
                });
                toast.success("Item updated");
            } else {
                // Add
                await InventoryService.addItem({
                    name: name.trim(),
                    quantity: Number(quantity),
                    item_type: itemType,
                    low_stock_threshold: (itemType === 'Part' || itemType === 'Consumable') ? lowStockThreshold : undefined,
                    location_id: locationId || undefined,
                    base_unit: baseUnit,
                    purchase_unit: purchaseUnit,
                    conversion_rate: conversionRate
                });
                toast.success("Item added");
            }
            // Trigger background sync
            processOfflineQueue();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            SmartError.show("Failed to save item", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* Mobile: Full Screen Edge-to-Edge. Desktop: Centered Modal */}
            <DialogContent
                onOpenAutoFocus={(e) => e.preventDefault()}
                className="fixed z-50 gap-0 p-0 shadow-lg bg-background 
                w-full h-full max-w-none top-0 left-0 translate-x-0 translate-y-0 rounded-none border-none
                sm:max-w-[425px] sm:h-auto sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border
                animate-in fade-in zoom-in-95 duration-200 flex flex-col">

                <DialogHeader className="p-6 pb-2 bg-background border-b border-border/40 flex-shrink-0">
                    <DialogTitle className="text-xl font-semibold">{initialItem ? "Edit Item" : "Add New Item"}</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-6">
                    <div className="grid gap-8">
                        {/* Type Select */}
                        <div className="grid gap-2">
                            <Label htmlFor="type" className="px-6 text-xs font-bold uppercase text-muted-foreground tracking-widest">Item Type</Label>
                            <Select value={itemType} onValueChange={(v: any) => setItemType(v)}>
                                <SelectTrigger className="text-lg h-16 px-6 rounded-none border-x-0 border-t-0 border-b border-border/50 bg-secondary/5 focus:ring-0 shadow-none">
                                    <SelectValue placeholder="Select Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Tool">Tool</SelectItem>
                                    <SelectItem value="Part">Part (Track Low Stock)</SelectItem>
                                    <SelectItem value="Consumable">Consumable (Track Low Stock)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Name Input */}
                        <div className="grid gap-2">
                            <Label htmlFor="name" className="px-6 text-xs font-bold uppercase text-muted-foreground tracking-widest">
                                Name
                            </Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="text-lg h-16 px-6 rounded-none border-x-0 border-t-0 border-b border-border/50 bg-secondary/5 focus-visible:ring-0 focus-visible:bg-secondary/10 transition-colors"
                                placeholder="e.g. 1/2in Screws"
                            />
                        </div>

                        {/* UOM Settings (Parts/Consumables) */}
                        {(itemType === 'Part' || itemType === 'Consumable') && (
                            <div className="grid gap-2 animate-in slide-in-from-top-2">
                                <Label className="px-6 text-xs font-bold uppercase text-muted-foreground tracking-widest">Unit of Measure</Label>
                                <div className="grid grid-cols-2 gap-4 px-6">
                                    <div className="grid gap-1">
                                        <Label htmlFor="base-unit" className="text-[10px] text-muted-foreground">Base Unit (e.g. Screw)</Label>
                                        <Input
                                            id="base-unit"
                                            value={baseUnit}
                                            onChange={(e) => setBaseUnit(e.target.value)}
                                            className="bg-secondary/5 border-border/50"
                                            placeholder="Ea"
                                        />
                                    </div>
                                    <div className="grid gap-1">
                                        <Label htmlFor="purchase-unit" className="text-[10px] text-muted-foreground">Purchase Unit (e.g. Box)</Label>
                                        <Input
                                            id="purchase-unit"
                                            value={purchaseUnit}
                                            onChange={(e) => setPurchaseUnit(e.target.value)}
                                            className="bg-secondary/5 border-border/50"
                                            placeholder="Box"
                                        />
                                    </div>
                                    <div className="col-span-2 grid gap-1">
                                        <Label htmlFor="conversion" className="text-[10px] text-muted-foreground">Rate (1 Purchase Unit = ? Base Units)</Label>
                                        <Input
                                            id="conversion"
                                            type="number"
                                            value={conversionRate}
                                            onChange={(e) => setConversionRate(Number(e.target.value))}
                                            className="bg-secondary/5 border-border/50"
                                            placeholder="1"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Quantity (Hidden if Asset) */}
                        {itemType !== 'Tool' && (
                            <div className="grid gap-2">
                                <Label htmlFor="quantity" className="px-6 text-xs font-bold uppercase text-muted-foreground tracking-widest">
                                    Quantity ({baseUnit})
                                </Label>
                                <Input
                                    id="quantity"
                                    type="number"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={quantity === 0 ? '' : quantity.toString()}
                                    onChange={(e) => setQuantity(Number(e.target.value))}
                                    className="text-lg h-16 px-6 rounded-none border-x-0 border-t-0 border-b border-border/50 bg-secondary/5 focus-visible:ring-0 focus-visible:bg-secondary/10 transition-colors"
                                />
                                {purchaseUnit && conversionRate > 1 && (
                                    <div className="px-6 text-xs text-muted-foreground">
                                        Approx {Math.floor(quantity / conversionRate)} {purchaseUnit}s
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Auto-Quantity Message for Assets */}
                        {itemType === 'Tool' && (
                            <div className="px-6 py-2 bg-secondary/10 text-sm text-muted-foreground">
                                Assets are tracked individually (Qty = 1).
                            </div>
                        )}

                        {/* Low Stock Threshold (Conditional) */}
                        {(itemType === 'Part' || itemType === 'Consumable') && (
                            <div className="grid gap-2 animate-in slide-in-from-top-2 mt-4">
                                <Label htmlFor="threshold" className="px-6 text-xs font-bold uppercase text-destructive tracking-widest">
                                    Low Stock Warning At
                                </Label>
                                <div className="flex items-center px-6 gap-4">
                                    <Input
                                        id="threshold"
                                        type="number"
                                        value={lowStockThreshold || ''}
                                        onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                                        placeholder="Default: 5"
                                        className="text-lg h-16 rounded-none border-x-0 border-t-0 border-b border-border/50 bg-destructive/5 focus-visible:ring-0 focus-visible:bg-destructive/10 transition-colors flex-1"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Location Select (Filtered) */}
                        <div className="grid gap-2">
                            <Label htmlFor="location" className="px-6 text-xs font-bold uppercase text-muted-foreground tracking-widest">Location</Label>
                            <Select value={locationId || "unassigned"} onValueChange={(v: string) => setLocationId(v === "unassigned" ? null : v)}>
                                <SelectTrigger className="h-16 px-6 rounded-none border-x-0 border-t-0 border-b border-border/50 bg-secondary/5 focus:ring-0 focus:bg-secondary/10 transition-colors text-lg">
                                    <SelectValue placeholder="Unassigned" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    <SelectItem disabled value="separator" className="text-xs font-bold opacity-50 pl-2">-- All Locations --</SelectItem>
                                    {locations?.map(loc => (
                                        <SelectItem key={loc.id} value={loc.id}>
                                            <div className="flex items-center gap-2">
                                                <span>{loc.name}</span>
                                                <span className="text-[10px] bg-muted px-1.5 rounded">{loc.type}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                    {/* Optional: Show roots disabled or at bottom if needed, but diagram implies strict nesting */}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 bg-card border-t border-border/40 mt-auto flex-shrink-0 sm:mt-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-12 text-base sm:hidden">Cancel</Button>
                    <Button type="submit" onClick={handleSave} disabled={loading} className="flex-1 h-12 text-base font-semibold shadow-lg shadow-primary/20">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
