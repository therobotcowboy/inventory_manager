"use client"

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Location, Item } from '@/lib/types';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Folder, Box, Archive, ArrowRight, Home, Wrench, Truck } from 'lucide-react';
import { SwipeableRow } from "@/components/ui/swipeable-row";
import { AlertTriangle } from 'lucide-react';

interface LocationViewProps {
    locationId: string | null; // Null = Root
    onNavigate: (id: string, name: string) => void;
    onEditItem: (item: Item) => void;
    onDeleteItem: (id: string, name: string) => void;
    onEditLocation: (location: Location) => void;
}

export function LocationView({ locationId, onNavigate, onEditItem, onDeleteItem, onEditLocation }: LocationViewProps) {
    // 1. Fetch Location Details (if not root)
    const currentLocation = useLiveQuery(async () => {
        if (!locationId) return null;
        return await db.locations.get(locationId);
    }, [locationId]);

    // 2. Fetch Child Locations
    const childLocations = useLiveQuery(async () => {
        if (!locationId) {
            // Root: Get all with no parent
            // Note: Dexie doesn't index null/undefined perfectly in all versions, 
            // but filtered query works.
            return await db.locations
                .filter(l => !l.parent_id)
                .toArray();
        } else {
            return await db.locations
                .where('parent_id').equals(locationId)
                .toArray();
        }
    }, [locationId]);

    // 3. Fetch Items in this Location
    const items = useLiveQuery(async () => {
        if (!locationId) return []; // Items shouldn't be at Root usually
        return await db.items
            .where('location_id').equals(locationId)
            .toArray();
    }, [locationId]);

    // Icon helper
    const getIcon = (type: Location['type']) => {
        switch (type) {
            case 'LOCATION':
                // Try to infer specific icon from name?
                return <Home className="w-8 h-8 text-blue-500" />;
            case 'AREA': return <Folder className="w-8 h-8 text-orange-500" />;
            case 'CONTAINER': return <Archive className="w-8 h-8 text-green-500" />;
            default: return <Box className="w-8 h-8 text-gray-500" />;
        }
    };

    if (locationId && currentLocation === undefined) {
        return <div className="p-8 text-center text-muted-foreground">Loading location...</div>;
    }

    const isEmpty = (childLocations?.length === 0) && (items?.length === 0);

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

            {/* Child Locations Grid */}
            {childLocations && childLocations.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                    {childLocations.map(loc => (
                        <Card
                            key={loc.id}
                            className="bg-card/40 border-white/5 hover:bg-white/5 transition-colors cursor-pointer active:scale-95 duration-100"
                            onClick={() => onNavigate(loc.id, loc.name)}
                        >
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-3 h-32 relative">
                                {getIcon(loc.type)}
                                <span className="font-semibold leading-tight text-sm line-clamp-2">
                                    {loc.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground uppercase tracking-widest bg-black/20 px-2 py-0.5 rounded-full">
                                    {loc.type}
                                </span>
                                {/* Editing Dot/Button? Maybe long press? For now, we omit edit location on grid to keep it clean, or add a small settings icon */}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Separator if both exist */}
            {childLocations?.length! > 0 && items?.length! > 0 && (
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-2 opacity-50">
                    Items in this {currentLocation?.type || 'Location'}
                </div>
            )}

            {/* Items List */}
            {items && items.length > 0 && (
                <div className="flex flex-col gap-3">
                    {items.map(item => (
                        <SwipeableRow
                            key={item.id}
                            onEdit={() => onEditItem(item)}
                            onDelete={() => onDeleteItem(item.id, item.name)}
                        >
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <div className="font-semibold text-white text-lg">{item.name}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="secondary" className="text-xs">
                                            Qty: {item.quantity}
                                        </Badge>
                                        {(item.low_stock_threshold !== undefined && item.quantity <= item.low_stock_threshold) && (
                                            <Badge variant="destructive" className="flex gap-1 items-center text-[10px] px-1 h-5">
                                                <AlertTriangle className="w-3 h-3" /> Low Stock
                                            </Badge>
                                        )}
                                        {item.item_type && (
                                            <Badge variant="outline" className="text-[10px] px-1 h-5 border-white/10 text-muted-foreground">
                                                {item.item_type}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </SwipeableRow>
                    ))}
                </div>
            )}

            {isEmpty && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-50">
                    <Box className="w-12 h-12 mb-2" />
                    <p>Empty Location</p>
                </div>
            )}
        </div>
    );
}
