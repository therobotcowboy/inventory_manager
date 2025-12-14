"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, AlertTriangle, Terminal } from 'lucide-react';
import { toast } from 'sonner';

interface LogEntry {
    id: string;
    type: 'error' | 'warn' | 'log';
    message: string;
    stack?: string;
    timestamp: string;
}

export function DebugLogger() {
    const [open, setOpen] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);

    useEffect(() => {
        // Intercept console.error
        const originalError = console.error;
        console.error = (...args: any[]) => {
            originalError(...args);
            const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
            const stack = new Error().stack;
            addLog('error', msg, stack);

            // Auto open on critical Supabase errors if valid JSON or string suggests it
            if (msg.includes("PostgREST") || msg.includes("schema cache") || msg.includes("RLS")) {
                toast.error("Database Error Detected: Check Debug Log");
                setOpen(true);
            }
        };

        // Intercept console.warn
        const originalWarn = console.warn;
        console.warn = (...args: any[]) => {
            originalWarn(...args);
            const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
            addLog('warn', msg);
        };

        return () => {
            console.error = originalError;
            console.warn = originalWarn;
        };
    }, []);

    const addLog = (type: LogEntry['type'], message: string, stack?: string) => {
        setLogs(prev => [
            {
                id: crypto.randomUUID(),
                type,
                message,
                stack,
                timestamp: new Date().toLocaleTimeString()
            },
            ...prev
        ].slice(0, 50)); // Keep last 50
    };

    if (!open) {
        return (
            <div className="fixed bottom-4 right-4 z-[9999]">
                <Button
                    variant={logs.find(l => l.type === 'error') ? "destructive" : "secondary"}
                    size="icon"
                    className="rounded-full shadow-lg h-12 w-12"
                    onClick={() => setOpen(true)}
                >
                    {logs.find(l => l.type === 'error') ? <AlertTriangle className="h-6 w-6" /> : <Terminal className="h-6 w-6" />}
                </Button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[9999] pointer-events-none flex items-end justify-end p-4 sm:p-6">
            <div className="bg-black/90 text-green-400 font-mono text-xs w-full sm:w-[500px] h-[400px] pointer-events-auto rounded-lg shadow-2xl flex flex-col border border-green-900/50">
                <div className="flex items-center justify-between p-2 border-b border-green-900/50 bg-green-950/20">
                    <span className="font-bold flex items-center gap-2">
                        <Terminal className="h-4 w-4" />
                        System Logs
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={async () => {
                                if (confirm("HARD RESET: This will wipe all local data and unsynced changes. Are you sure?")) {
                                    try {
                                        // Dynamic import to avoid SSR issues if any, though here client side
                                        const { db } = await import('@/lib/db');
                                        await db.delete();
                                        window.location.reload();
                                    } catch (e) {
                                        alert("Failed to reset: " + e);
                                    }
                                }
                            }}
                            className="h-6 text-[10px] px-2 bg-red-900/50 hover:bg-red-900 border border-red-800"
                        >
                            Hard Reset
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setLogs([])} className="h-6 text-[10px] hover:text-green-300">Clear</Button>
                        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="h-6 w-6 p-0 hover:text-green-300"><X className="h-4 w-4" /></Button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {logs.length === 0 && <div className="opacity-50 text-center mt-10">No logs captured.</div>}
                    {logs.map(log => (
                        <div key={log.id} className={`pb-2 border-b border-white/10 ${log.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                            <div className="flex justify-between opacity-50 mb-1">
                                <span>[{log.timestamp}]</span>
                                <span className="uppercase font-bold">{log.type}</span>
                            </div>
                            <div className="whitespace-pre-wrap break-words">{log.message}</div>
                            {log.stack && (
                                <details className="mt-1">
                                    <summary className="cursor-pointer opacity-50 hover:opacity-100">Stack Trace</summary>
                                    <pre className="text-[10px] bg-black/50 p-2 mt-1 rounded overflow-x-auto">
                                        {log.stack}
                                    </pre>
                                </details>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
