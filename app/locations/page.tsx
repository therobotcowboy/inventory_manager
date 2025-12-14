"use client";

import { useState } from 'react';
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Pencil, Trash2, MapPin, FolderOpen, ChevronRight } from "lucide-react";
import Link from "next/link";
import { LocationDialog } from '@/components/location-dialog';
import { SwipeableRow } from "@/components/ui/swipeable-row";
import { Location } from '@/lib/types';
import { toast } from '@/lib/toast';
import { processOfflineQueue } from '@/lib/sync-engine';
import { InventoryService } from '@/lib/inventory-service';
import { DeleteConfirmDialog } from '@/components/delete-confirm-dialog';
import { SmartError } from "@/components/ui/smart-error";

export default function LocationsPage() {
    // ... hooks ...
    const locations = useLiveQuery(() => db.locations.toArray());
    const items = useLiveQuery(() => db.items.toArray());
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingLoc, setEditingLoc] = useState<Location | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string, name: string } | null>(null);

    // ... handlers ...
    const openAddDialog = () => {
        setEditingLoc(null);
        setDialogOpen(true);
    };

    const openEditDialog = (loc: Location) => {
        setEditingLoc(loc);
        setDialogOpen(true);
    };

    const handleDelete = (id: string, name: string) => {
        setDeleteTarget({ id, name });
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            await InventoryService.deleteLocation(deleteTarget.id);
            processOfflineQueue();
            toast.success("Location deleted");
        } catch (e: any) {
            SmartError.show("Failed to delete location", e);
        } finally {
            setDeleteTarget(null);
        }
    };

    const getItemCount = (locationId: string) => {
        return items?.filter(i => i.location_id === locationId).length || 0;
    };

    const renderLocationNode = (loc: Location, level: number = 0) => {
        const children = locations?.filter(l => l.parent_id === loc.id) || [];
        const itemCount = getItemCount(loc.id);

        return (
            <div key={loc.id} className="flex flex-col">
                <SwipeableRow
                    onEdit={() => openEditDialog(loc)}
                    onDelete={() => handleDelete(loc.id, loc.name)}
                >
                    <Card className="bg-card border-border shadow-sm hover:bg-muted/50 transition-colors rounded-xl overflow-hidden">
                        <Link href={`/locations/${loc.id}`} className="block h-full cursor-pointer">
                            <CardContent className="p-4 flex items-center justify-between active:bg-white/5 transition-colors">
                                <div className="flex items-center gap-4" style={{ paddingLeft: `${level * 16}px` }}>
                                    <div className="shrink-0 text-muted-foreground">
                                        {level === 0 ? <MapPin className="h-5 w-5 text-primary" /> : <FolderOpen className="h-5 w-5" />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-foreground text-lg">{loc.name}</span>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className="uppercase tracking-wide">{loc.type}</span>
                                            <span>•</span>
                                            <span className="text-primary/80">{itemCount} items</span>
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground/50" />
                            </CardContent>
                        </Link>
                    </Card>
                </SwipeableRow>
                {children.map(child => renderLocationNode(child, level + 1))}
            </div>
        );
    };

    // ... rest of render ...
    const topLevelLocations = locations?.filter(l => !l.parent_id) || [];

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-24">
            <LocationDialog open={dialogOpen} onOpenChange={setDialogOpen} initialLocation={editingLoc} />
            <DeleteConfirmDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                onConfirm={handleConfirmDelete}
                title="Delete Location"
                description={`Are you sure you want to delete "${deleteTarget?.name}"? You cannot delete a location that contains items or sub-locations.`}
            />

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Locations</h1>
                </div>
                <Button onClick={openAddDialog} size="sm" className="bg-primary hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-2" /> Add
                </Button>
            </div>

            <div className="flex flex-col gap-3">
                {locations?.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground p-8 border border-dashed border-white/10 rounded-lg">
                        <MapPin className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-50" />
                        <p>No locations yet.</p>
                        <p className="text-xs text-muted-foreground/50 mt-1">Create "Van 1" or "Garage"</p>
                    </div>
                )}
                {topLevelLocations.map(loc => renderLocationNode(loc))}
            </div>
        </div>
    );
}
