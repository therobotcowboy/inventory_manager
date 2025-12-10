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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{initialLocation ? "Edit Location" : "Add Location"}</DialogTitle>
                    <DialogDescription>
                        Create a place to store your tools (e.g., Van, Bin, Shelf).
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="col-span-3"
                            placeholder="e.g. Bin A"
                        />
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="type" className="text-right">Type</Label>
                        <Select value={type} onValueChange={(v: string) => setType(v as any)}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="VAN">Van / Vehicle</SelectItem>
                                <SelectItem value="SHELF">Shelf</SelectItem>
                                <SelectItem value="BIN">Bin</SelectItem>
                                <SelectItem value="JOB_SITE">Job Site</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="parent" className="text-right">Parent</Label>
                        <Select value={parentId || "none"} onValueChange={(v: string) => setParentId(v === "none" ? null : v)}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="None (Top Level)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None (Top Level)</SelectItem>
                                {availableParents.map(loc => (
                                    <SelectItem key={loc.id} value={loc.id}>
                                        {loc.name} ({loc.type})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button type="submit" onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
