"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings, Trash2, Database, Info, GitBranch } from "lucide-react";
import { db } from "@/lib/db";
import { toast } from "@/lib/toast";
import { Badge } from "@/components/ui/badge";

import { useLiveQuery } from "dexie-react-hooks";
import { APP_METADATA } from "@/lib/constants";
import { DebugConsole } from "./debug-console";

export function SettingsDialog() {
    const [open, setOpen] = useState(false);

    // Live Stats
    const itemCount = useLiveQuery(() => db.items.count());
    const locCount = useLiveQuery(() => db.locations.count());

    const handleReset = async () => {
        if (confirm("⚠️ HARD RESET WARNING ⚠️\n\nThis will WIPE ALL LOCAL DATA and reload the app.\n\nAre you sure completely sure?")) {
            try {
                await db.delete();
                toast.success("Database wiped. Reloading...");
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } catch (e) {
                toast.error("Failed to reset database");
                console.error(e);
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                    <Settings className="h-5 w-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm rounded-2xl gap-0 p-0 overflow-hidden bg-background border-border">
                <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/40">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Settings className="w-5 h-5 text-primary" />
                        Settings
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6 space-y-6">
                    {/* App Info */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">App Info</h4>
                        <div className="bg-muted/40 rounded-lg p-4 space-y-3 border border-border">
                            <div className="flex justify-between items-center text-sm">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    <GitBranch className="w-4 h-4" /> Version
                                </span>
                                <Badge variant="secondary" className="font-mono">{APP_METADATA.fullVersion}</Badge>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    <Database className="w-4 h-4" /> Local Data
                                </span>
                                <span className="text-foreground">
                                    {itemCount !== undefined ? `${itemCount} Items, ${locCount} Locs` : 'Loading...'}
                                </span>
                            </div>
                        </div>
                    </div>


                    {/* Debug Console */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">System Terminal</h4>
                        <DebugConsole />
                    </div>

                    {/* DANGER ZONE */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-red-400 uppercase tracking-wider flex items-center gap-2">
                            <AlertDot /> Danger Zone
                        </h4>
                        <div className="bg-red-500/5 rounded-lg border border-red-500/20 p-1">
                            <Button
                                variant="ghost"
                                className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10 h-12"
                                onClick={handleReset}
                            >
                                <Trash2 className="w-4 h-4 mr-3" />
                                Wipe Local Data & Reset
                            </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground/60 px-1">
                            Use this if the app gets stuck or sync fails repeatedly. It will delete all data on this device and re-download from the server (if synced) or reset to defaults.
                        </p>
                    </div>
                </div>

                <DialogFooter className="p-4 bg-muted/40 border-t border-border">
                    <div className="w-full text-center text-[10px] text-muted-foreground/40">
                        Build ID: {APP_METADATA.buildId}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function AlertDot() {
    return (
        <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
    );
}
