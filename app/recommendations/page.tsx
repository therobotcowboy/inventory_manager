"use client";

import { useState } from 'react';
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Lightbulb, CheckCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { toast } from '@/lib/toast';

export default function RecommendationsPage() {
    const [jobDescription, setJobDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [streamedItems, setStreamedItems] = useState<any[]>([]);

    // Fetch local inventory for matching
    const items = useLiveQuery(() => db.items.toArray());

    const handleGetAdvice = async () => {
        if (!jobDescription) {
            toast.warning("Please describe the job first.");
            return;
        }

        setLoading(true);
        setStreamedItems([]); // Clear previous results

        try {
            const response = await fetch('/api/generate-recs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobDescription })
            });

            if (!response.ok) throw new Error("Network error");
            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                // Keep the last part in buffer if it's not a complete line (doesn't end in newline)
                // However, split logic means the last element is the remainder. 
                // If the chunk ended exactly on newline, last element is empty string.
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (!line.trim()) continue;

                    // CSV Parse: ItemName|Reason
                    const parts = line.split("|");
                    if (parts.length >= 2) {
                        const name = parts[0].trim();
                        const reason = parts[1].trim();

                        // Real-time Match
                        const match = items?.find(i =>
                            i.name.toLowerCase().includes(name.toLowerCase()) ||
                            name.toLowerCase().includes(i.name.toLowerCase())
                        );

                        const newItem = {
                            name,
                            reason,
                            status: match ? 'READY' : 'MISSING',
                            match: match || null
                        };

                        setStreamedItems(prev => {
                            const newSet = [...prev, newItem];
                            // Sort on update: Missing first
                            return newSet.sort((a, b) =>
                                (a.status === 'MISSING' ? -1 : 1) - (b.status === 'MISSING' ? -1 : 1)
                            );
                        });
                    }
                }
            }

            // Flush remaining buffer
            if (buffer.trim()) {
                const line = buffer;
                const parts = line.split("|");
                if (parts.length >= 2) {
                    const name = parts[0].trim();
                    const reason = parts[1].trim();
                    const match = items?.find(i => i.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(i.name.toLowerCase()));
                    setStreamedItems(prev => [...prev, { name, reason, status: match ? 'READY' : 'MISSING', match: match || null }]);
                }
            }

            toast.success("Analysis Complete");

        } catch (error) {
            console.error(error);
            toast.error("Failed to get recommendations.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-24">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Job Planner</h1>
                    <p className="text-muted-foreground text-sm">Instant Loadout Generator</p>
                </div>
            </div>

            {/* Input Section */}
            <Card className="bg-card/50 border-white/10">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-yellow-500" />
                        What's the job?
                    </CardTitle>
                    <CardDescription>
                        Streaming AI will generate your checklist instantly.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Textarea
                        placeholder="e.g. Installing a ceiling fan..."
                        className="bg-background/50 border-white/10 min-h-[100px]"
                        value={jobDescription}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setJobDescription(e.target.value)}
                    />
                    <Button
                        className="w-full bg-blue-600 hover:bg-blue-500"
                        size="lg"
                        onClick={handleGetAdvice}
                        disabled={loading && streamedItems.length === 0} // Only disable initial load, allow appending
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Planning...
                            </>
                        ) : (
                            "Generate Loadout"
                        )}
                    </Button>
                </CardContent>
            </Card>

            {/* Results Section */}
            {streamedItems.length > 0 && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                    <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-white">
                            Required Items ({streamedItems.length})
                        </h3>

                        <div className="grid gap-3">
                            {streamedItems.map((item: any, idx: number) => (
                                <div key={idx} className={`border border-l-4 p-4 rounded-r-lg flex justify-between items-center animate-in slide-in-from-left-2 duration-300 ${item.status === 'READY'
                                    ? 'bg-card border-white/5 border-l-green-500'
                                    : 'bg-card border-white/5 border-l-orange-500'
                                    }`}>
                                    <div>
                                        <h4 className="font-bold text-white flex items-center gap-2">
                                            {item.name}
                                            {item.status === 'READY' && (
                                                <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                    Ready
                                                </span>
                                            )}
                                            {item.status === 'MISSING' && (
                                                <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                    Missing
                                                </span>
                                            )}
                                        </h4>
                                        <p className="text-sm text-muted-foreground">{item.reason}</p>

                                        {item.status === 'READY' && item.match && (
                                            <p className="text-xs text-green-500/80 mt-1 flex items-center gap-1">
                                                <CheckCircle className="w-3 h-3" /> In Inventory
                                            </p>
                                        )}
                                    </div>

                                    {item.status === 'MISSING' && (
                                        <Button size="sm" variant="outline" onClick={() => toast.info("Shop List Check")}>
                                            Add
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
