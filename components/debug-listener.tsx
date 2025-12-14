"use client";

import { useEffect } from 'react';
import { debugStore } from '@/lib/debug-store';
import { toast } from '@/lib/toast';

export function DebugListener() {
    useEffect(() => {
        // Intercept console.error
        const originalError = console.error;
        console.error = (...args: any[]) => {
            originalError(...args);
            const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
            const stack = new Error().stack;
            debugStore.addLog('error', msg, stack);

            // Auto toast on critical Dabase errors
            if (msg.includes("PostgREST") || msg.includes("schema cache") || msg.includes("RLS")) {
                toast.error("Database Error Detected: Check Settings > Debug");
            }
        };

        // Intercept console.warn
        const originalWarn = console.warn;
        console.warn = (...args: any[]) => {
            originalWarn(...args);
            const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
            debugStore.addLog('warn', msg);
        };

        return () => {
            console.error = originalError;
            console.warn = originalWarn;
        };
    }, []);

    return null; // Render nothing
}
