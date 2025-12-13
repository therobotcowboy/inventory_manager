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
import { Location } from '@/lib/types';
import { toast } from 'sonner';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase'; // For direct insert/update logic if not using a service yet
import { processOfflineQueue } from '@/lib/sync-engine';

interface LocationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialLocation?: Location | null;
}

export function LocationDialog({ open, onOpenChange, initialLocation }: LocationDialogProps) {
    const [name, setName] = useState('');
    const [type, setType] = useState<Location['type']>('VAN');
    const [parentId, setParentId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Fetch existing locations for parent dropdown
    const locations = useLiveQuery(() => db.locations.toArray());

    useEffect(() => {
        if (open) {
            if (initialLocation) {
                setName(initialLocation.name);
                setType(initialLocation.type);
                setParentId(initialLocation.parent_id || null);
            } else {
                setName('');
                setType('VAN');
                setParentId(null);
            }
        }
    }, [open, initialLocation]);

    const handleSave = async () => {
        if (!name.trim()) {
            toast.warning("Name is required");
            return;
        }

        setLoading(true);
        try {
            const id = initialLocation?.id || crypto.randomUUID();
            const locationData: Location = {
                id,
                name: name.trim(),
                type: type,
                parent_id: parentId || undefined
            };

            if (initialLocation) {
                await db.locations.update(id, locationData);
                // Queue Update
                await db.offlineQueue.add({
                    timestamp: new Date().toISOString(),
                    type: 'SYNC_PUSH',
                    payload: { table: 'locations', action: 'UPDATE', data: locationData },
                    synced: false
                });
            } else {
                await db.locations.add(locationData);
                // Queue Insert
                await db.offlineQueue.add({
                    timestamp: new Date().toISOString(),
                    type: 'SYNC_PUSH',
                    payload: { table: 'locations', action: 'INSERT', data: locationData },
                    synced: false
                });
            }

            processOfflineQueue();
            toast.success(initialLocation ? "Location updated" : "Location added");
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast.error("Failed to save location");
        } finally {
            setLoading(false);
        }
    };

    // Filter potential parents to avoid circular dependency (basic: can't pick self)
    const availableParents = locations?.filter(l => l.id !== initialLocation?.id) || [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* Mobile: Full Screen Edge-to-Edge. Desktop: Centered Modal */}
            <DialogContent
                onOpenAutoFocus={(e) => e.preventDefault()}
                className="fixed z-50 gap-0 p-0 shadow-lg bg-background
                w-full h-full max-w-none top-0 left-0 translate-x-0 translate-y-0 rounded-none border-none
                sm:max-w-md sm:h-auto sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border
                animate-in fade-in zoom-in-95 duration-200 flex flex-col"
            >
                <DialogHeader className="p-6 pb-2 bg-background border-b border-border/40 flex-shrink-0">
                    <DialogTitle className="text-xl font-semibold">{initialLocation ? "Edit Location" : "Add Location"}</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-6">
                    <div className="grid gap-8">
                        {/* Name Input */}
                        <div className="grid gap-2">
                            <Label htmlFor="name" className="px-6 text-xs font-bold uppercase text-muted-foreground tracking-widest">Location Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Van 1, Garage, Bin A"
                                className="text-lg h-16 px-6 rounded-none border-x-0 border-t-0 border-b border-border/50 bg-secondary/5 focus-visible:ring-0 focus-visible:bg-secondary/10 transition-colors"
                            />
                        </div>

                        {/* Type Select */}
                        <div className="grid gap-2">
                            <Label htmlFor="type" className="px-6 text-xs font-bold uppercase text-muted-foreground tracking-widest">Type</Label>
                            <Select value={type} onValueChange={(v: string) => setType(v as any)}>
                                <SelectTrigger className="text-lg h-16 px-6 rounded-none border-x-0 border-t-0 border-b border-border/50 bg-secondary/5 focus:ring-0 shadow-none">
                                    <SelectValue placeholder="Select Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="VAN">Van / Vehicle</SelectItem>
                                    <SelectItem value="SHELF">Shelf / Rack</SelectItem>
                                    <SelectItem value="BIN">Bin / Box</SelectItem>
                                    <SelectItem value="JOB_SITE">Job Site</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Parent Select */}
                        <div className="grid gap-2">
                            <Label htmlFor="parent" className="px-6 text-xs font-bold uppercase text-muted-foreground tracking-widest">Parent Location (Optional)</Label>
                            <Select value={parentId || "none"} onValueChange={(v: string) => setParentId(v === "none" ? null : v)}>
                                <SelectTrigger className="text-lg h-16 px-6 rounded-none border-x-0 border-t-0 border-b border-border/50 bg-secondary/5 focus:ring-0 shadow-none">
                                    <SelectValue placeholder="None (Top Level)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None (Top Level)</SelectItem>
                                    {availableParents.map(loc => (
                                        <SelectItem key={loc.id} value={loc.id}>
                                            {loc.name} <span className="text-muted-foreground text-xs ml-2">({loc.type})</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 bg-card border-t border-border/40 mt-auto flex-shrink-0 sm:mt-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-12 text-base">
                        Cancel
                    </Button>
                    <Button type="submit" onClick={handleSave} disabled={loading} className="flex-1 h-12 text-base font-semibold shadow-lg shadow-primary/20">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Location
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
