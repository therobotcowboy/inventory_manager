"use client";

import { useState } from 'react';
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Pencil, Trash2, MapPin, FolderOpen } from "lucide-react";
import Link from "next/link";
import { LocationDialog } from '@/components/location-dialog';
import { Location } from '@/lib/types';
import { toast } from 'sonner';
import { processOfflineQueue } from '@/lib/sync-engine';

export default function LocationsPage() {
    const locations = useLiveQuery(() => db.locations.toArray());
    const items = useLiveQuery(() => db.items.toArray());
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingLoc, setEditingLoc] = useState<Location | null>(null);

    const openAddDialog = () => {
        setEditingLoc(null);
        setDialogOpen(true);
    };

    const openEditDialog = (loc: Location) => {
        setEditingLoc(loc);
        setDialogOpen(true);
    };

    const handleDelete = async (id: string, name: string) => {
        // Check if has children
        const hasChildren = locations?.some(l => l.parent_id === id);
        if (hasChildren) {
            toast.error("Cannot delete a location with sub-locations.");
            return;
        }

        if (confirm(`Delete ${name}?`)) {
            try {
                await db.locations.delete(id);
                // Queue Delete
                await db.offlineQueue.add({
                    timestamp: new Date().toISOString(),
                    type: 'SYNC_PUSH',
                    payload: { table: 'locations', action: 'DELETE', data: { id } },
                    synced: false
                });
                processOfflineQueue();
                toast.success("Location deleted");
            } catch (e) {
                console.error(e);
                toast.error("Failed to delete");
            }
        }
    };

    // Helper to get total items in a location
    const getItemCount = (locationId: string) => {
        return items?.filter(i => i.location_id === locationId).length || 0;
    };

    // Recursive function to render hierarchy
    const renderLocationNode = (loc: Location, level: number = 0) => {
        const children = locations?.filter(l => l.parent_id === loc.id) || [];
        const itemCount = getItemCount(loc.id);

        return (
            <div key={loc.id} className="flex flex-col">
                <Link href={`/locations/${loc.id}`}>
                    <Card className="mb-2 bg-card border-white/5 hover:bg-card/80 transition-colors cursor-pointer group">
                        <CardContent className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3" style={{ marginLeft: `${level * 24}px` }}>
                                {level === 0 ? <MapPin className="h-4 w-4 text-primary group-hover:text-blue-400 transition-colors" /> : <FolderOpen className="h-4 w-4 text-muted-foreground group-hover:text-blue-400 transition-colors" />}
                                <div>
                                    <div className="font-medium text-white group-hover:text-blue-400 transition-colors">{loc.name}</div>
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase">
                                        <span>{loc.type}</span>
                                        <span className="text-white/20">•</span>
                                        <span className="text-blue-400">{itemCount} items</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1" onClick={(e) => e.preventDefault()}>
                                {/* Stop propagation on buttons so we can click Edit/Delete without navigating */}
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10" onClick={(e) => { e.stopPropagation(); openEditDialog(loc); }}>
                                    <Pencil className="h-3 w-3 text-muted-foreground" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10" onClick={(e) => { e.stopPropagation(); handleDelete(loc.id, loc.name); }}>
                                    <Trash2 className="h-3 w-3 text-red-400" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
                {children.map(child => renderLocationNode(child, level + 1))}
            </div>
        );
    };

    // Top level nodes
    const topLevelLocations = locations?.filter(l => !l.parent_id) || [];

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-24">
            <LocationDialog open={dialogOpen} onOpenChange={setDialogOpen} initialLocation={editingLoc} />

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Locations</h1>
                </div>
                <Button onClick={openAddDialog} size="sm" className="bg-primary hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-2" /> Add
                </Button>
            </div>

            <div className="flex flex-col gap-1">
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
