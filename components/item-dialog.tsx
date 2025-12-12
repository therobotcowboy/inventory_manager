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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{initialItem ? "Edit Item" : "Add New Item"}</DialogTitle>
                    <DialogDescription>
                        {initialItem ? "Make changes to your inventory here." : "Enter the details for the new tool or part."}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Name
                        </Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="col-span-3"
                            placeholder="e.g. 1/2in Screws"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="quantity" className="text-right">
                            Quantity
                        </Label>
                        <Input
                            id="quantity"
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            className="col-span-3"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4 pb-4">
                    <Label htmlFor="location" className="text-right">Location</Label>
                    <Select value={locationId || "unassigned"} onValueChange={(v: string) => setLocationId(v === "unassigned" ? null : v)}>
                        <SelectTrigger className="col-span-3">
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
                <DialogFooter>
                    <Button type="submit" onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
