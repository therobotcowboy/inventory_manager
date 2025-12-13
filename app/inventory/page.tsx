"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Box, Search, AlertTriangle, Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { ItemDialog } from '@/components/item-dialog';
import { SwipeableRow } from "@/components/ui/swipeable-row";
import { Item } from '@/lib/types';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUpDown, X } from "lucide-react";
import { InventoryService } from '@/lib/inventory-service';
import { toast } from 'sonner';
import { processOfflineQueue } from '@/lib/sync-engine';

export default function InventoryPage() {
    const items = useLiveQuery(() => db.items.toArray());
    const locations = useLiveQuery(() => db.locations.toArray());
    const [search, setSearch] = useState("");

    // Sort & Filter State
    const [sortBy, setSortBy] = useState<'name' | 'recent' | 'quantity' | 'type'>('recent');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc'); // Helper for potential future toggle, effectively used implicitly for now
    const [showLowStockOnly, setShowLowStockOnly] = useState(false);

    // Manual Management State
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Item | null>(null);

    // Initial Loading State
    if (!items || !locations) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Process Items (Filter -> Sort)
    const processedItems = items
        .filter(item => {
            // 1. Search
            const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
                (item.category || '').toLowerCase().includes(search.toLowerCase());
            if (!matchesSearch) return false;

            // 2. Low Stock Filter
            if (showLowStockOnly) {
                const isLow = item.quantity <= item.low_stock_threshold;
                // "Ignore Items classified as 'Tool'"
                const isTool = (item.category || '').toLowerCase() === 'tool';
                // Show only if low AND NOT a tool (assumes Part/Consumable or undefined)
                return isLow && !isTool;
            }

            return true;
        })
        .sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'quantity':
                    // Low to High
                    return a.quantity - b.quantity;
                case 'type':
                    return (a.category || '').localeCompare(b.category || '');
                case 'recent':
                    // Default desc (newest first)
                    return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
                default: return 0;
            }
        });

    const openAddDialog = () => {
        setEditingItem(null);
        setDialogOpen(true);
    };

    const openEditDialog = (item: Item) => {
        setEditingItem(item);
        setDialogOpen(true);
    };

    const getLocationName = (id?: string) => {
        if (!id) return "Unassigned";
        return locations.find(l => l.id === id)?.name || "Unknown";
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

    const lowStockCount = items.filter(i =>
        i.quantity <= i.low_stock_threshold && (i.category || '').toLowerCase() !== 'tool'
    ).length;

    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-500 pb-24">

            <ItemDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                initialItem={editingItem}
            />

            {/* Header */}
            <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                    <Link href="/">
                        <Button variant="ghost" size="icon" className="-ml-2">
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                    </Link>
                    <h1 className="text-xl font-bold tracking-tight text-white">Inventory</h1>
                </div>
                <Button onClick={openAddDialog} size="sm" className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                    <Plus className="h-4 w-4 mr-1" /> Add Item
                </Button>
            </div>

            {/* E. Condensed Top Metrics */}
            <div className="grid grid-cols-2 gap-3">
                <Card className="bg-card/40 border-white/5 shadow-inner h-14">
                    <CardContent className="h-full flex items-center justify-between px-4 py-0">
                        <div className="flex flex-col justify-center h-full gap-0.5">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold leading-none">Total</span>
                            <span className="text-xl font-bold text-white leading-none">{items.length}</span>
                        </div>
                        <Box className="h-4 w-4 text-muted-foreground/50" />
                    </CardContent>
                </Card>
                <Card className={showLowStockOnly ? "bg-orange-500/10 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.1)] h-14" : "bg-card/40 border-white/5 shadow-inner h-14"}>
                    <CardContent className="h-full flex items-center justify-between px-4 py-0 cursor-pointer" onClick={() => setShowLowStockOnly(!showLowStockOnly)}>
                        <div className="flex flex-col justify-center h-full gap-0.5">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold text-orange-400 leading-none">Low Stock</span>
                            <span className="text-xl font-bold text-orange-500 leading-none">{lowStockCount}</span>
                        </div>
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                    </CardContent>
                </Card>
            </div>

            {/* F. Search & H. Filters */}
            <div className="flex flex-col gap-3 sticky top-0 z-40 bg-background py-2 -mx-4 px-4 border-b border-white/5 shadow-sm">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="Search tools, parts..."
                        // Increased height (h-12) and text size
                        className="pl-12 h-12 text-lg bg-secondary/10 border-white/10 focus-visible:ring-primary/50"
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

                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {/* Sort Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 border-dashed border-white/20 hover:bg-white/10 active:bg-white/20 cursor-pointer">
                                <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
                                Sort: <span className="ml-1 text-white font-medium capitalize">{sortBy}</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                            <DropdownMenuLabel>Sort Order</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setSortBy('recent')}>
                                Recent
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSortBy('name')}>
                                Alphabetical (A-Z)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSortBy('quantity')}>
                                Quantity (Low to High)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSortBy('type')}>
                                Type (Category)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Low Stock Toggle Pill */}
                    <Button
                        variant={showLowStockOnly ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                        className={showLowStockOnly ? "bg-orange-500/20 text-orange-500 hover:bg-orange-500/30 border-orange-500/50" : "border-dashed border-white/20 bg-transparent text-muted-foreground"}
                    >
                        <AlertTriangle className="mr-2 h-3.5 w-3.5" />
                        Low Stock Only
                    </Button>
                </div>
            </div>

            {/* Items List */}
            <div className="flex flex-col gap-3 pb-24 min-h-[50vh]">
                {processedItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-4">
                        <Search className="h-12 w-12 opacity-20" />
                        <p className="text-sm">{search ? "No matching items found." : "No inventory items."}</p>
                        {showLowStockOnly && (
                            <Button variant="link" onClick={() => setShowLowStockOnly(false)}>Clear filters</Button>
                        )}
                    </div>
                ) : (
                    processedItems.map(item => (
                        <SwipeableRow
                            key={item.id}
                            onEdit={() => openEditDialog(item)}
                            onDelete={() => handleDelete(item.id, item.name)}
                        >
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <div className="font-semibold text-white text-lg">{item.name}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="secondary" className="text-xs">
                                            Qty: {item.quantity}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs border-white/10 text-muted-foreground flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                                            {getLocationName(item.location_id)}
                                        </Badge>
                                        {item.quantity <= item.low_stock_threshold && (
                                            <Badge variant="destructive" className="flex gap-1 items-center text-[10px] px-1 h-5">
                                                <AlertTriangle className="w-3 h-3" /> Low
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </SwipeableRow>
                    ))
                )}
            </div>
        </div>
    );
}
