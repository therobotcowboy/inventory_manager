"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Wrench, Search, AlertTriangle, Loader2, Plus, Pencil, Trash2, MapPin, ClipboardList, Camera, Mic } from "lucide-react";
import { toast } from 'sonner';
import { processOfflineQueue } from '@/lib/sync-engine';
import Link from "next/link";
import { SettingsDialog } from "@/components/settings-dialog";

export default function Home() {
  return (
    <div className="flex flex-col gap-6 pb-24 h-[calc(100vh-2rem)] relative">
      {/* Welcome Section */}
      <section className="flex items-start justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {(() => {
            const hour = new Date().getHours();
            if (hour < 12) return "Good Morning, Joe.";
            if (hour < 17) return "Good Afternoon, Joe.";
            return "Good Evening, Joe.";
          })()}
        </h1>
        <SettingsDialog />
      </section>

      {/* Main Action Stack (Vertical) */}
      <section className="flex flex-col gap-4">

        {/* Inventory Card */}
        <Link href="/inventory" className="block group">
          <Card className="h-[100px] rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden
            bg-[var(--im-card-inventory-bg)] 
            border-[var(--im-card-inventory-border)] 
            hover:border-[var(--im-card-inventory-text)]
            flex flex-col justify-center px-6">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-1">
                <Wrench className="h-6 w-6 stroke-[2.5px] text-[var(--im-card-inventory-text)]" />
                <h3 className="text-[18px] font-semibold text-[var(--im-card-inventory-text)]">
                  Inventory
                </h3>
              </div>
              <p className="text-[13px] font-normal text-foreground opacity-70">
                Manage tools, parts, and consumables
              </p>
            </div>
          </Card>
        </Link>

        {/* Locations Card */}
        <Link href="/locations" className="block group">
          <Card className="h-[100px] rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden
            bg-[var(--im-card-blue-bg)] 
            border-[var(--im-card-blue-border)] 
            hover:border-[var(--im-card-blue-text)]
            flex flex-col justify-center px-6">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-1">
                <MapPin className="h-6 w-6 stroke-[2.5px] text-[var(--im-card-blue-text)]" />
                <h3 className="text-[18px] font-semibold text-[var(--im-card-blue-text)]">
                  Locations
                </h3>
              </div>
              <p className="text-[13px] font-normal text-foreground opacity-70">
                Manage Sites, Vans, Bins, and Shelves
              </p>
            </div>
          </Card>
        </Link>

        {/* Job Recs Card */}
        <Link href="/recommendations" className="block group">
          <Card className="h-[100px] rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden
            bg-[var(--im-card-blue-bg)] 
            border-[var(--im-card-blue-border)] 
            hover:border-[var(--im-card-blue-text)]
            flex flex-col justify-center px-6">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-1">
                <ClipboardList className="h-6 w-6 stroke-[2.5px] text-[var(--im-card-blue-text)]" />
                <h3 className="text-[18px] font-semibold text-[var(--im-card-blue-text)]">
                  Job Recs
                </h3>
              </div>
              <p className="text-[13px] font-normal text-foreground opacity-70">
                Job load-out helper
              </p>
            </div>
          </Card>
        </Link>

      </section>

      {/* Floating Action Buttons (FABs) */}
      <div className="fixed bottom-6 left-6 z-50">
        <Button
          size="icon"
          className="h-14 w-14 rounded-full bg-[var(--im-orange-vivid)] hover:bg-[var(--im-orange-vivid)]/90 text-white !border-0 !shadow-none !ring-0 !outline-none"
          style={{ boxShadow: 'none', border: 'none' }}
        >
          <Camera className="h-6 w-6" />
        </Button>
      </div>

      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="icon"
          className="h-14 w-14 rounded-full bg-[var(--im-orange-vivid)] hover:bg-[var(--im-orange-vivid)]/90 text-white !border-0 !shadow-none !ring-0 !outline-none"
          style={{ boxShadow: 'none', border: 'none' }}
        >
          <Mic className="h-6 w-6" />
        </Button>
      </div>

    </div>
  );
}

