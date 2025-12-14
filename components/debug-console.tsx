"use client";

import { useEffect, useState, useRef } from 'react';
import { debugStore, LogEntry } from '@/lib/debug-store';
import { Button } from "@/components/ui/button";
import { Terminal, X, Trash2, RefreshCw } from 'lucide-react';
import { toast } from '@/lib/toast';

export function DebugConsole() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Initial Fetch
        setLogs(debugStore.getLogs());

        // Subscribe
        const unsubscribe = debugStore.subscribe((newLogs) => {
            setLogs(newLogs);
        });
        return unsubscribe;
    }, []);

    // Auto-scroll logic: If near bottom, scroll to match
    // For now, simpler: Scroll to top of list? 
    // Actually typically logs are new at bottom? 
    // Store unshift (new at top) or push (new at bottom)?
    // Store implementation: `[entry, ...this.logs]` -> New items at TOP.
    // So we don't need auto-scroll to bottom, just overflow-y-auto.

    const handleReset = async () => {
        if (confirm("HARD RESET: This will wipe all local data and unsynced changes. Are you sure?")) {
            try {
                // Dynamic import to avoid SSR issues
                const { db } = await import('@/lib/db');
                await db.delete();
                window.location.reload();
            } catch (e) {
                alert("Failed to reset: " + e);
            }
        }
    };

    return (
        <div className={`flex flex-col bg-black rounded-lg border border-border/20 overflow-hidden font-mono text-xs transition-all duration-300 ${isExpanded ? 'h-[300px]' : 'h-10'}`}>
            {/* Toolbar */}
            <div
                className="flex items-center justify-between p-2 bg-white/5 border-b border-white/10 cursor-pointer hover:bg-white/10"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Terminal className="w-4 h-4" />
                    <span className="font-bold">System Logs</span>
                    <span className="text-[10px] opacity-50 ml-2">
                        {isExpanded ? '(Click to Collapse)' : '(Click to Expand)'}
                    </span>
                </div>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => debugStore.clear()}
                        className="h-6 px-2 text-muted-foreground hover:text-foreground"
                    >
                        <Trash2 className="w-3 h-3 mr-1" /> Clear
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleReset}
                        className="h-6 px-2 text-[10px]"
                    >
                        HARD RESET
                    </Button>
                </div>
            </div>

            {/* Logs Area */}
            <div className={`flex-1 overflow-y-auto p-4 space-y-2 ${!isExpanded && 'hidden'}`}>
                {logs.length === 0 && (
                    <div className="text-center text-muted-foreground opacity-50 py-8">
                        No logs captured.
                    </div>
                )}
                {logs.map(log => (
                    <div key={log.id} className={`pb-2 border-b border-white/5 ${log.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                        <div className="flex justify-between opacity-50 mb-0.5 text-[10px]">
                            <span>[{log.timestamp}]</span>
                            <span className="uppercase font-bold">{log.type}</span>
                        </div>
                        <div className="whitespace-pre-wrap break-words opacity-90">{log.message}</div>
                        {log.stack && (
                            <details className="mt-1">
                                <summary className="cursor-pointer opacity-50 hover:opacity-100 text-[10px]">Stack Trace</summary>
                                <pre className="text-[10px] bg-white/5 p-2 mt-1 rounded overflow-x-auto">
                                    {log.stack}
                                </pre>
                            </details>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
