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
    onDeleteLocation: (id: string, name: string) => void;
    onEditLocation: (location: Location) => void;
}

export function LocationView({ locationId, onNavigate, onEditItem, onDeleteItem, onDeleteLocation, onEditLocation }: LocationViewProps) {
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

    // 3. Fetch Items in this Location (or Loose Items if Root)
    const items = useLiveQuery(async () => {
        if (!locationId) {
            // Root: Get unassigned items
            return await db.items
                .filter(i => !i.location_id || i.location_id === 'unassigned') // robustness
                .toArray();
        }
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

            {/* Child Locations Grid -> converted to List for Swipe Support */}
            {childLocations && childLocations.length > 0 && (
                <div className="flex flex-col gap-3">
                    {childLocations.map(loc => (
                        <SwipeableRow
                            key={loc.id}
                            onEdit={() => onEditLocation(loc)}
                            onDelete={() => onDeleteLocation(loc.id, loc.name)}
                        >
                            <Card
                                className="bg-card border-border shadow-sm hover:bg-muted/50 transition-colors"
                            >
                                <CardContent
                                    className="p-4 flex items-center justify-between cursor-pointer active:bg-white/5 transition-colors"
                                    onClick={() => onNavigate(loc.id, loc.name)}
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Icon: Minimum 44x44px target via sizing */}
                                        <div className="shrink-0 text-muted-foreground w-11 h-11 flex items-center justify-center bg-secondary/20 rounded-lg">
                                            {getIcon(loc.type)}
                                        </div>

                                        <div className="flex flex-col">
                                            <span className="font-semibold text-foreground text-lg leading-tight">
                                                {loc.name}
                                            </span>
                                            <span className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wide">
                                                {loc.type}
                                            </span>
                                        </div>
                                    </div>

                                    <ArrowRight className="h-5 w-5 text-muted-foreground/50" />
                                </CardContent>
                            </Card>
                        </SwipeableRow>
                    ))}
                </div>
            )}

            {/* Separator / Header Logic */}
            {items && items.length > 0 && (
                <div className="pt-2">
                    {!locationId ? (
                        <div className="flex items-center gap-4 mb-3">
                            <div className="h-px bg-border flex-1" />
                            <span className="text-xs font-bold text-orange-500 uppercase tracking-widest whitespace-nowrap flex items-center gap-2">
                                <AlertTriangle className="h-3 w-3" /> Loose Items
                            </span>
                            <div className="h-px bg-border flex-1" />
                        </div>
                    ) : (
                        (childLocations?.length! > 0) && (
                            <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-2 opacity-50 mb-3">
                                Items in this {currentLocation?.type || 'Location'}
                            </div>
                        )
                    )}

                    <div className="flex flex-col gap-3">
                        {items.map(item => (
                            <SwipeableRow
                                key={item.id}
                                onEdit={() => onEditItem(item)}
                                onDelete={() => onDeleteItem(item.id, item.name)}
                            >
                                <CardContent className={`p-4 flex items-center justify-between ${!locationId ? 'bg-orange-500/5' : ''}`}> {/* Highlight loose items slightly */}
                                    <div>
                                        <div className="font-semibold text-foreground text-lg">{item.name}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="secondary" className="text-xs">
                                                Qty: {item.quantity}
                                            </Badge>
                                            {(item.low_stock_threshold != null && item.quantity <= item.low_stock_threshold) && (
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
