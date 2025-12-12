"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Box, Search, AlertTriangle, Loader2, Plus, Pencil, Trash2, MapPin, ClipboardList } from "lucide-react";
import { toast } from 'sonner';
import { processOfflineQueue } from '@/lib/sync-engine';
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Welcome Section */}
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Good Morning, Joe.</h1>
        <p className="text-muted-foreground">Ready to track some tools?</p>
      </section>

      {/* Quick Actions Grid */}
      <section className="grid grid-cols-2 gap-4">
        <Link href="/inventory" className="block group">
          <Card className="bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/20 transition-all cursor-pointer h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-yellow-500 group-hover:text-yellow-400 flex items-center gap-2">
                <Box className="h-5 w-5" />
                Inventory
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Manage tools & parts manually.</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/locations" className="block group">
          <Card className="bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20 transition-all cursor-pointer h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-blue-500 group-hover:text-blue-400 flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Locations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Manage vans, bins & sites.</p>
            </CardContent>
          </Card>
        </Link>

        <Card className="col-span-2 bg-card/50 hover:bg-card/80 transition-colors cursor-pointer border-l-4 border-l-blue-500/50">
          <Link href="/recommendations" className="block w-full h-full cursor-pointer">
            <div className="p-6">
              <CardHeader className="p-0 pb-2">
                <ClipboardList className="w-8 h-8 text-blue-500 mb-2" />
                <CardTitle className="text-lg">Job Recs</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <p className="text-sm text-muted-foreground">What do I need?</p>
              </CardContent>
            </div>
          </Link>
        </Card>
      </section>

    </div>
  );
}

