"use client";

import dynamic from 'next/dynamic';
import { Loader2 } from "lucide-react";

// Dynamically import the main view with SSR disabled
const InventoryView = dynamic(() => import('@/components/inventory-view'), {
    ssr: false,
    loading: () => (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    )
});

export const dynamicParams = true; // Ensure dynamic handling if needed

export default function InventoryPage() {
    return <InventoryView />;
}
