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
        if (!items || items.length === 0) {
            toast.warning("Your inventory is empty! Add tools first.");
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const data = await getJobRecommendationsAction(items, jobDescription);
            setResult(data);
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
                    <h1 className="text-2xl font-bold tracking-tight text-white">Job Advisor</h1>
                    <p className="text-muted-foreground text-sm">AI-powered tool check</p>
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
                        Describe what you're doing, and I'll check if you have the tools.
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
                                Analyzing Inventory...
                            </>
                        ) : (
                            "Check My Toolkit"
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

                    {/* Missing Items */}
                    <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-white">
                            <AlertTriangle className="h-5 w-5 text-orange-500" />
                            Missing Items
                        </h3>
                        {result.missing_items && result.missing_items.length > 0 ? (
                            <div className="grid gap-3">
                                {result.missing_items.map((item: any, idx: number) => (
                                    <div key={idx} className="bg-card border border-l-4 border-l-orange-500 border-white/5 p-4 rounded-r-lg flex justify-between items-center">
                                        <div>
                                            <h4 className="font-bold text-white">{item.name}</h4>
                                            <p className="text-sm text-muted-foreground">{item.reason}</p>
                                        </div>
                                        <Button size="sm" variant="outline" onClick={() => toast.info("Shopping List feature coming soon!")}>
                                            Add
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-lg text-center">
                                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                                <p className="text-green-400 font-medium">You have everything you need!</p>
                            </div>
                        )}
                    </div>

                </div>
            )}
        </div>
    );
}
