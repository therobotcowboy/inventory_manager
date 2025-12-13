"use client"

import { useEffect } from 'react';
import { syncPull, processOfflineQueue } from '@/lib/sync-engine';
import { seedDatabase } from '@/lib/db';

export function SyncManager() {
    useEffect(() => {
        // Initial Sync on Load
        seedDatabase(); // Check and seed roots if empty
        syncPull();
        processOfflineQueue();

        // Polling Interval (e.g. every 30s)
        const interval = setInterval(() => {
            // Only try if online
            if (navigator.onLine) {
                processOfflineQueue();
                syncPull(); // Keep local fresh
            }
        }, 30000);

        // Initial listener
        const onOnline = () => {
            processOfflineQueue();
            syncPull();
        };

        window.addEventListener('online', onOnline);

        return () => {
            clearInterval(interval);
            window.removeEventListener('online', onOnline);
        }
    }, []);

    return null; // Headless component
}
