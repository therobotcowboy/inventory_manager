"use client";

import { useState } from 'react';
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { getJobRecommendationsAction } from '../actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Lightbulb, CheckCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { toast } from '@/lib/toast';

export default function RecommendationsPage() {
    const [jobDescription, setJobDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    // Fetch local inventory
    const items = useLiveQuery(() => db.items.toArray());

    const handleGetAdvice = async () => {
        if (!jobDescription) {
            toast.warning("Please describe the job first.");
            return;
        }
        // Removed Blocking Check for Empty Inventory

        setLoading(true);
        setResult(null);

        try {
            // Step 1: Get Ideal Loadout (Stateless)
            const data = await getJobRecommendationsAction(jobDescription);

            // Step 2: Client-side Matching
            if (data.required_items) {
                const processedItems = data.required_items.map((req: any) => {
                    const reqName = req.name.toLowerCase();
                    // Fuzzy match: check if we have an item that contains the required name
                    // In real app, might want smarter fuzzy logic or vector search
                    const match = items?.find(i =>
                        i.name.toLowerCase().includes(reqName) ||
                        reqName.includes(i.name.toLowerCase())
                    );

                    return {
                        ...req,
                        status: match ? 'READY' : 'MISSING',
                        match: match ? match : null
                    };
                });

                // Sort: Missing first, then Ready
                data.processed_items = processedItems.sort((a: any, b: any) =>
                    (a.status === 'MISSING' ? -1 : 1) - (b.status === 'MISSING' ? -1 : 1)
                );
            }

            setResult(data);
            toast.success("Planner Ready");
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
                    <p className="text-muted-foreground text-sm">AI Tool Checklist</p>
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
                        Generate a pro loadout list and check what you have.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Textarea
                        placeholder="e.g. Installing a ceiling fan in a drywall ceiling..."
                        className="bg-background/50 border-white/10 min-h-[100px]"
                        value={jobDescription}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setJobDescription(e.target.value)}
                    />
                    <Button
                        className="w-full bg-blue-600 hover:bg-blue-500"
                        size="lg"
                        onClick={handleGetAdvice}
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Planning Job...
                            </>
                        ) : (
                            "Generate Loadout"
                        )}
                    </Button>
                </CardContent>
            </Card>

            {/* Results Section */}
            {result && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">

                    {/* Advice Card */}
                    {result.advice && (
                        <Card className="bg-blue-500/10 border-blue-500/20">
                            <CardContent className="pt-6">
                                <p className="text-blue-200 italic">"{result.advice}"</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Planner List */}
                    <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-white">
                            Required Items
                        </h3>

                        {result.processed_items && result.processed_items.length > 0 ? (
                            <div className="grid gap-3">
                                {result.processed_items.map((item: any, idx: number) => (
                                    <div key={idx} className={`border border-l-4 p-4 rounded-r-lg flex justify-between items-center ${item.status === 'READY'
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

                                            {/* Location Hint if Ready */}
                                            {item.status === 'READY' && item.match && item.match.location_id && (
                                                <p className="text-xs text-green-500/80 mt-1 flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" /> In Inventory
                                                </p>
                                            )}
                                        </div>

                                        {item.status === 'MISSING' && (
                                            <Button size="sm" variant="outline" onClick={() => toast.info("Added to Shopping List (Sim)")}>
                                                Add
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-muted-foreground italic">No specific items generated.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
