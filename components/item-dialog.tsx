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
                setLocationId(initialItem.location_id || null);
            } else {
                setName('');
                setQuantity(0);
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
                    location_id: locationId || undefined
                });
                toast.success("Item updated");
            } else {
                // Add
                await InventoryService.addItem({
                    name: name.trim(),
                    quantity: Number(quantity),
                    low_stock_threshold: 5,
                    category: 'Uncategorized',
                    location_id: locationId || undefined
                });
                toast.success("Item added");
            }
            // Trigger background sync
            processOfflineQueue();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast.error("Failed to save item");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* Mobile: Full Screen Edge-to-Edge. Desktop: Centered Modal */}
            <DialogContent className="fixed z-50 gap-0 p-0 shadow-lg bg-card 
                w-full h-full top-0 left-0 translate-x-0 translate-y-0 rounded-none border-none
                sm:max-w-[425px] sm:h-auto sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border
                animate-in fade-in zoom-in-95 duration-200 flex flex-col">

                <DialogHeader className="p-6 pb-4 bg-gradient-to-b from-card to-card/95 border-b border-border/40 flex-shrink-0">
                    <DialogTitle className="text-xl">{initialItem ? "Edit Item" : "Add New Item"}</DialogTitle>
                    <DialogDescription>
                        {initialItem ? "Make changes to your inventory here." : "Enter the details for the new tool or part."}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 py-4">
                    <div className="grid gap-8">
                        <div className="grid gap-3">
                            <Label htmlFor="name" className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                                Name
                            </Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="text-lg h-14 px-4 bg-secondary/20 border-transparent focus:border-primary transition-all"
                                placeholder="e.g. 1/2in Screws"
                            />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="quantity" className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                                Quantity
                            </Label>
                            <Input
                                id="quantity"
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={quantity === 0 ? '' : quantity.toString()}
                                onChange={(e) => setQuantity(Number(e.target.value))}
                                className="text-lg h-14 w-full bg-secondary/20 border-transparent focus:border-primary transition-all"
                            />
                        </div>

                        <div className="grid gap-3">
                            <Label htmlFor="location" className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Location</Label>
                            <Select value={locationId || "unassigned"} onValueChange={(v: string) => setLocationId(v === "unassigned" ? null : v)}>
                                <SelectTrigger className="h-14 bg-secondary/20 border-transparent text-lg">
                                    <SelectValue placeholder="Unassigned" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {locations?.map(loc => (
                                        <SelectItem key={loc.id} value={loc.id}>
                                            {loc.name}
                                        </SelectItem>
                                    ))}
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
