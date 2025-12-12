"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Pencil, Trash2, MapPin, FolderOpen, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ItemDialog } from '@/components/item-dialog';
import { Item, Location } from '@/lib/types';
import { InventoryService } from '@/lib/inventory-service';
import { toast } from 'sonner';
import { processOfflineQueue } from '@/lib/sync-engine';
import { useParams, useRouter } from 'next/navigation';

export default function LocationDetailPage() {
    const params = useParams();
    const router = useRouter();
    const locationId = params.id as string;

    const [showNested, setShowNested] = useState(true);

    const location = useLiveQuery(() => db.locations.get(locationId), [locationId]);
    const subLocations = useLiveQuery(() => db.locations.where('parent_id').equals(locationId).toArray(), [locationId]);

    // Recursive Item Fetching
    const items = useLiveQuery(async () => {
        if (!locationId) return [];

        // 1. Get Direct Items
        if (!showNested) {
            return db.items.where('location_id').equals(locationId).toArray();
        }

        // 2. Get Recursive Items
        // Fetch all locations to build tree (efficient for < 1000 items)
        const allLocs = await db.locations.toArray();

        const getDescendants = (parentId: string): string[] => {
            const children = allLocs.filter(l => l.parent_id === parentId);
            let ids = children.map(c => c.id);
            for (const child of children) {
                ids = [...ids, ...getDescendants(child.id)];
            }
            return ids;
        };

        const allLocationIds = [locationId, ...getDescendants(locationId)];

        // Dexie 'anyOf' is great for this
        return db.items.where('location_id').anyOf(allLocationIds).toArray();

        // ... (rest of logic)
    }, [locationId, showNested]);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Item | null>(null);

    if (!location) {
        return <div className="p-8 text-center text-muted-foreground">Loading location...</div>;
    }

    const openAddDialog = () => {
        setEditingItem(null);
        setDialogOpen(true);
    };

    const openEditDialog = (item: Item) => {
        setEditingItem(item);
        setDialogOpen(true);
    };

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`Are you sure you want to delete ${name}?`)) {
            try {
                await InventoryService.deleteItem(id);
                processOfflineQueue();
                toast.success("Item deleted");
            } catch (e) {
                console.error(e);
                toast.error("Failed to delete");
            }
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-24">
            <ItemDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                initialItem={editingItem}
                // Pre-select this location for new items
                defaultLocationId={locationId}
            />

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white">{location?.name}</h1>
                        <p className="text-xs text-muted-foreground uppercase">{location?.type}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Toggle Button for Nested View */}
                    <Button
                        variant={showNested ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setShowNested(!showNested)}
                        className="text-xs"
                    >
                        {showNested ? "Showing All Nested" : "Direct Items Only"}
                    </Button>
                    <Button onClick={openAddDialog} size="sm" className="bg-primary hover:bg-primary/90">
                        <Plus className="h-4 w-4 mr-2" /> Add Item
                    </Button>
                </div>
            </div>

            {/* Sub Locations */}
            {subLocations && subLocations.length > 0 && (
                <div className="grid gap-2">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Sub-Locations</h2>
                    {subLocations.map(sub => (
                        <Link key={sub.id} href={`/locations/${sub.id}`}>
                            <Card className="bg-card/50 hover:bg-card transition-colors border-white/5">
                                <CardContent className="p-3 flex items-center gap-3">
                                    <FolderOpen className="h-4 w-4 text-primary" />
                                    <span className="font-medium text-white">{sub.name}</span>
                                    <Badge variant="outline" className="ml-auto text-xs border-white/10">
                                        Sub-location
                                    </Badge>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}

            {/* Items List */}
            <div className="grid gap-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        {showNested ? `Items in ${location?.name} (+ sub-locations)` : `Items in ${location?.name}`}
                    </h2>
                    <span className="text-xs text-muted-foreground">{items?.length || 0} items</span>
                </div>

                {!items || items.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border border-dashed border-white/10 rounded-lg">
                        This location is empty.
                    </div>
                ) : (
                    items.map(item => (
                        <Card key={item.id} className="bg-card hover:bg-card/80 transition-colors border-white/5">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <div className="font-semibold text-white text-lg">{item.name}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="secondary" className="text-xs">
                                            Qty: {item.quantity}
                                        </Badge>
                                        {/* Show Location Badge if item is in a sub-location */}
                                        {showNested && item.location_id !== locationId && (
                                            <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                                                <MapPin className="w-3 h-3 mr-1" />
                                                In Sub-location
                                            </Badge>
                                        )}
                                        {item.quantity <= item.low_stock_threshold && (
                                            <Badge variant="destructive" className="flex gap-1 items-center text-[10px] px-1 h-5">
                                                <AlertTriangle className="w-3 h-3" /> Low
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
                                        <Pencil className="h-4 w-4 text-muted-foreground hover:text-white" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id, item.name)}>
                                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
