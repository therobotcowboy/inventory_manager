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
import { Item } from '@/lib/types';
import { InventoryService } from '@/lib/inventory-service';
import { toast } from 'sonner';
import { processOfflineQueue } from '@/lib/sync-engine';

export default function InventoryPage() {
    const items = useLiveQuery(() => db.items.toArray());
    const [search, setSearch] = useState("");

    // Manual Management State
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Item | null>(null);

    // Initial Loading State
    if (!items) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase())
    );

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
            />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Inventory</h1>
                </div>
                {/* Floating Add Button (Header for desktop, or separate FAB) */}
                <Button onClick={openAddDialog} size="sm" className="bg-primary hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-2" /> Add
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
                <Card className="bg-card/50 border-white/10">
                    <CardContent className="p-4 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold text-white">{items.length}</span>
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Items</span>
                    </CardContent>
                </Card>
                <Card className="bg-card/50 border-white/10">
                    <CardContent className="p-4 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold text-orange-500">
                            {items.filter(i => i.quantity <= i.low_stock_threshold).length}
                        </span>
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Low Stock</span>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search tools & parts..."
                    className="pl-9 bg-background/50 border-white/10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* List */}
            <div className="grid gap-3">
                {filteredItems.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        {search ? "No matches found." : "Inventory is empty."}
                    </div>
                ) : (
                    filteredItems.map(item => (
                        <Card key={item.id} className="bg-card hover:bg-card/80 transition-colors border-white/5">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <div className="font-semibold text-white text-lg">{item.name}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="secondary" className="text-xs">
                                            Qty: {item.quantity}
                                        </Badge>
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
