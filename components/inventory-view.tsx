"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Box, Search, AlertTriangle, Loader2, Plus, Pencil, Trash2, Home, ChevronRight, Folder, FolderOpen, Archive, X } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { ItemDialog } from '@/components/item-dialog';
import { LocationDialog } from '@/components/location-dialog';
import { SwipeableRow } from "@/components/ui/swipeable-row";
import { Item, Location } from '@/lib/types';
import { InventoryService } from '@/lib/inventory-service';
import { toast } from 'sonner';
import { processOfflineQueue } from '@/lib/sync-engine';
import { useSearchParams, useRouter } from 'next/navigation';
import { LocationView } from '@/components/hierarchy/location-view';
import { SmartError } from "@/components/ui/smart-error";
import { SettingsDialog } from "@/components/settings-dialog";

export default function InventoryView() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // URL State
    const currentLocationId = searchParams.get('loc') || null;

    // Main Queries
    const items = useLiveQuery(() => db.items.toArray());
    const locations = useLiveQuery(() => db.locations.toArray());

    const [search, setSearch] = useState("");
    const [showLowStockOnly, setShowLowStockOnly] = useState(false);

    // Dialog State
    const [itemDialogOpen, setItemDialogOpen] = useState(false);
    const [locationDialogOpen, setLocationDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [editingLocation, setEditingLocation] = useState<Location | null>(null);

    // --- Search Logic (Global) ---
    const isSearching = search.length > 0;
    const filteredGlobalItems = useMemo(() => {
        if (!items || !locations) return [];
        if (!isSearching && !showLowStockOnly) return [];
        return items.filter(item => {
            // Search
            const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) ||
                (item.item_type || '').toLowerCase().includes(search.toLowerCase());

            // Low Stock
            const isLow = showLowStockOnly ? (item.low_stock_threshold !== undefined && item.quantity <= item.low_stock_threshold) : true;

            return matchesSearch && isLow;
        });
    }, [items, locations, search, showLowStockOnly, isSearching]);

    // --- Breadcrumb Logic ---
    // Recursively build path
    const breadcrumbs = useMemo(() => {
        if (!locations) return [];
        const path: Location[] = [];
        let currentid = currentLocationId;
        // Safety Break to prevent infinite loop
        let iterations = 0;
        while (currentid && iterations < 10) {
            const loc = locations.find(l => l.id === currentid);
            if (loc) {
                path.unshift(loc);
                currentid = loc.parent_id || null;
            } else {
                break;
            }
            iterations++;
        }
        return path;
    }, [currentLocationId, locations]);

    // Initial Loading (Moved after hooks)
    if (!items || !locations) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const currentLocation = currentLocationId ? locations.find(l => l.id === currentLocationId) : null;

    // --- Actions ---
    const handleDeleteItem = async (id: string, name: string) => {
        if (confirm(`Are you sure you want to delete ${name}?`)) {
            try {
                await InventoryService.deleteItem(id);
                processOfflineQueue();
                toast.success("Item deleted");
            } catch (e) {
                SmartError.show("Failed to delete item", e);
            }
        }
    };

    const handleNavigate = (id: string) => {
        const params = new URLSearchParams(searchParams);
        params.set('loc', id);
        router.push(`/inventory?${params.toString()}`);
    };

    const handleNavigateUp = () => {
        if (currentLocation?.parent_id) {
            handleNavigate(currentLocation.parent_id);
        } else {
            router.push('/inventory'); // Root
        }
    };

    // Helper to get location name for Search Results
    const getLocationName = (id?: string) => locations.find(l => l.id === id)?.name || "Unassigned";

    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-500 pb-24">

            <ItemDialog
                open={itemDialogOpen}
                onOpenChange={setItemDialogOpen}
                initialItem={editingItem}
                defaultLocationId={currentLocationId || undefined} // Pass context!
            />

            <LocationDialog
                open={locationDialogOpen}
                onOpenChange={setLocationDialogOpen}
                initialLocation={editingLocation}
                defaultParentId={currentLocationId} // Pass context!
            />

            {/* Header */}
            <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                    <Link href="/">
                        <Button variant="ghost" size="icon" className="-ml-2">
                            <Home className="h-6 w-6" />
                        </Button>
                    </Link>
                    <h1 className="text-xl font-bold tracking-tight text-foreground">Inventory</h1>
                </div>
                {/* Context Aware Add Button */}
                <div className="flex gap-2 items-center">
                    {/* Debug: Show current location type if exists */}
                    {/* <div className="text-[10px] text-muted-foreground mr-2">{currentLocation?.type || 'ROOT'}</div> */}

                    {/* Only show 'Add Location' if we are not deep in a container */}
                    {(!currentLocation || currentLocation.type !== 'CONTAINER') && (
                        <Button
                            onClick={() => { setEditingLocation(null); setLocationDialogOpen(true); }}
                            size="sm"
                            variant="secondary"
                            className="bg-secondary/50 hover:bg-secondary/80 text-secondary-foreground shadow-sm px-3"
                        >
                            <FolderOpen className="h-4 w-4 mr-1.5" />
                            <span className="hidden xs:inline">Add Area</span>
                            <span className="xs:hidden">Add</span>
                        </Button>
                    )}
                    <Button onClick={() => { setEditingItem(null); setItemDialogOpen(true); }} size="sm" className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 h-8 px-3">
                        <Plus className="h-4 w-4 mr-1" /> Item
                    </Button>
                </div>
            </div>

            {/* Sticky Search Bar */}
            <div className="sticky top-0 z-40 bg-background py-2 -mx-4 px-4 border-b border-border shadow-sm space-y-2">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="Search items..."
                        className="pl-12 h-12 text-lg bg-secondary/20 border-border focus-visible:ring-primary/50"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent"
                            onClick={() => setSearch("")}
                        >
                            <X className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    )}
                </div>

                {/* Breadcrumbs (Only if not searching) */}
                {!isSearching && (
                    <div className="flex items-center flex-wrap gap-1 text-sm bg-secondary/5 p-2 rounded-lg border border-white/5">
                        <button
                            onClick={() => router.push('/inventory')}
                            className={`flex items-center hover:bg-white/10 px-1.5 py-0.5 rounded transition-colors ${!currentLocationId ? 'font-bold text-primary' : 'text-muted-foreground'}`}
                        >
                            <Home className="w-3.5 h-3.5 mr-1" /> Root
                        </button>

                        {breadcrumbs.map((crumb, i) => (
                            <div key={crumb.id} className="flex items-center gap-1">
                                <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                                <button
                                    onClick={() => handleNavigate(crumb.id)}
                                    className={`px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors whitespace-nowrap 
                                        ${i === breadcrumbs.length - 1 ? 'font-bold text-primary' : 'text-muted-foreground'}`}
                                >
                                    {crumb.name}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            {isSearching ? (
                // --- Global Search Results ---
                <div className="flex flex-col gap-3 min-h-[50vh]">
                    <div className="text-sm font-semibold text-muted-foreground px-1 uppercase tracking-wider">
                        Search Results ({filteredGlobalItems.length})
                    </div>
                    {filteredGlobalItems.length === 0 ? (
                        <div className="text-center py-12 opacity-50">No matches found.</div>
                    ) : (
                        filteredGlobalItems.map(item => (
                            <SwipeableRow
                                key={item.id}
                                onEdit={() => { setEditingItem(item); setItemDialogOpen(true); }}
                                onDelete={() => handleDeleteItem(item.id, item.name)}
                            >
                                <CardContent
                                    className="p-4 flex items-center justify-between cursor-pointer active:bg-white/5 transition-colors"
                                    onClick={() => item.location_id && handleNavigate(item.location_id)}
                                >
                                    <div>
                                        <div className="font-semibold text-foreground text-lg">{item.name}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="secondary" className="text-xs">Qty: {item.quantity}</Badge>
                                            <Badge variant="outline" className="text-xs border-border text-muted-foreground flex items-center gap-1 hover:text-foreground hover:border-primary/30 transition-colors">
                                                {getLocationName(item.location_id)} <ChevronRight className="h-3 w-3" />
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="text-muted-foreground">
                                        <ChevronRight className="h-5 w-5 opacity-50" />
                                    </div>
                                </CardContent>
                            </SwipeableRow>
                        ))
                    )}
                </div>
            ) : (
                // --- Hierarchical View ---
                <LocationView
                    locationId={currentLocationId}
                    onNavigate={(id, name) => handleNavigate(id)}
                    onEditItem={(item) => { setEditingItem(item); setItemDialogOpen(true); }}
                    onDeleteItem={handleDeleteItem}
                    onEditLocation={(loc) => { setEditingLocation(loc); setLocationDialogOpen(true); }}
                />
            )}
        </div>
    );
}
