"use client"

import { toast } from 'sonner';
import { X, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import React from 'react';

// internal state for grouping
let lastErrorTime = 0;
let errorQueue: { message: string, details?: any }[] = [];
let currentToastId: string | number | null = null;
let resetTimer: NodeJS.Timeout | null = null;

const RESET_DELAY = 4000; // Reset grouping if no errors for 4s

export const SmartError = {
    show: (message: string, details?: any) => {
        const now = Date.now();

        // Add to queue
        errorQueue.push({ message, details });
        lastErrorTime = now;

        // Clear existing reset timer
        if (resetTimer) clearTimeout(resetTimer);

        // Set new reset timer to clear queue
        resetTimer = setTimeout(() => {
            errorQueue = [];
            currentToastId = null;
        }, RESET_DELAY);

        // Render content
        const count = errorQueue.length;
        const isMultiple = count > 1;
        const mainMessage = isMultiple ? `${count} Errors Occurred` : message;

        // If we have an active toast for this batch, dismiss/update it? 
        // Sonner allows updating if we have ID.
        if (currentToastId) {
            toast.dismiss(currentToastId);
        }

        currentToastId = toast.custom((t) => (
            <ErrorToastContent
                t={t}
                message={mainMessage}
                errors={errorQueue}
            />
        ), {
            duration: 4000, // Default duration
            id: 'smart-error-group' // Fixed ID to prevent stacking visual clutter? No, use dynamic if we want stacking.
        });
    }
};

function ErrorToastContent({ t, message, errors }: { t: any, message: string, errors: any[] }) {
    const [expanded, setExpanded] = React.useState(false);

    // If expanded, pause existing dismiss logic? 
    // Sonner doesn't expose pause easily via custom component unless we control it.
    // However, the user requirement: "If expanded, disable auto-dismiss".
    // We can do this by dismissing the current toast and spawning a persistent one?
    // OR, simpler: The custom component can't easily change the hook's duration dynamically.
    // WORKAROUND: If user clicks expand, we assume they want to keep it.
    // We can re-trigger a permanent toast with same content?

    // Better idea: Just use a long duration if expanded? We can't change props.
    // We will just allow the user to read. If it disappears, they can check logs? 
    // Wait, requirement is Strict: "Give user ability to close it... do not go away".

    // So: On Expand -> Replace with Permanent Toast.

    const handleExpand = () => {
        if (!expanded) {
            setExpanded(true);
            // Re-spawn as infinite
            toast.dismiss(t);
            toast.custom((newT) => (
                <PersistentErrorContent
                    t={newT}
                    message={message}
                    errors={errors}
                />
            ), { duration: Infinity, id: 'expanded-error-view' });
        }
    };

    return (
        <div className="w-[356px] relative p-4 bg-destructive text-destructive-foreground rounded-xl shadow-lg border border-destructive/20 flex flex-col gap-2">
            <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex-1">
                    <div className="font-semibold text-sm pr-6 leading-tight">
                        {message}
                    </div>
                    {!expanded && errors.length === 1 && errors[0].details && (
                        <div className="text-xs opacity-90 mt-1 line-clamp-2">
                            Tap arrow for details
                        </div>
                    )}
                </div>
                <button
                    onClick={handleExpand}
                    className="absolute top-4 right-4 p-1 hover:bg-black/10 rounded-full transition-colors"
                >
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
}

function PersistentErrorContent({ t, message, errors }: { t: any, message: string, errors: any[] }) {
    return (
        <div className="w-[356px] p-4 bg-destructive text-destructive-foreground rounded-xl shadow-2xl border border-destructive/20 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="w-5 h-5" />
                    {message}
                </div>
                <button onClick={() => toast.dismiss(t)} className="p-1 hover:bg-black/20 rounded-full">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="max-h-[200px] overflow-y-auto rounded bg-black/10 p-2 text-xs font-mono space-y-2">
                {errors.map((e, i) => (
                    <div key={i} className="border-b border-white/10 last:border-0 pb-2 last:pb-0">
                        <div className="font-bold mb-1">Error {i + 1}: {e.message}</div>
                        {e.details && (
                            <div className="opacity-80 break-all">
                                {typeof e.details === 'object' ? JSON.stringify(e.details, null, 2) : String(e.details)}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="text-[10px] text-center opacity-70">
                You can copy these details to share with support.
            </div>
        </div>
    );
}
