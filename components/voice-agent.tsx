"use client"

import { useState } from 'react';
import { Mic, Square, Loader2, Check, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { parseVoiceCommandAction, analyzeImageAction } from '@/app/actions';
import { ParsedVoiceCommand } from '@/lib/types';
import { cn } from '@/lib/utils';
import { db } from '@/lib/db';
import { processOfflineQueue } from '@/lib/sync-engine';
import { InventoryService } from '@/lib/inventory-service';

export function VoiceAgent() {
    const { isListening, transcript, startListening, stopListening, resetTranscript, hasRecognitionSupport } = useSpeechRecognition();

    const [processing, setProcessing] = useState(false);
    const [parsedCommand, setParsedCommand] = useState<ParsedVoiceCommand | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const handleToggleListening = () => {
        if (isListening) {
            stopListening();
            // Wait a moment for final transcript then process
            handleProcess();
        } else {
            resetTranscript();
            setParsedCommand(null);
            startListening();
        }
    };

    const handleProcess = async () => {
        setProcessing(true);
        await new Promise(r => setTimeout(r, 500)); // Keep a tiny UI feel delay

        // Handle empty transcript
        if (!transcript && process.env.NODE_ENV !== 'development') {
            toast.warning("I didn't hear anything. Try speaking louder.");
            setProcessing(false);
            return;
        }

        try {
            // Real Server Action Call
            // If transcript is empty, we force a test string for dev purposes if needed.
            const cmdText = (transcript && transcript.length > 2) ? transcript : "Test command bought 5 boxes of screws";

            if (cmdText.startsWith("Test")) {
                toast.info("Using Test Command (Mic was silent)");
            }

            const result = await parseVoiceCommandAction(cmdText);
            setParsedCommand(result);
            setIsDialogOpen(true);
        } catch (e: any) {
            console.error("AI Error", e);
            toast.error(`Error: ${e.message || "Unknown parsing error"}`);
        } finally {
            setProcessing(false);
            resetTranscript();
        }
    };

    const handleConfirm = async () => {
        if (!parsedCommand) return;

        try {
            await InventoryService.processCommand(parsedCommand);

            // Trigger Sync immediately
            processOfflineQueue();
            toast.success(`Updated ${parsedCommand.item}`);

        } catch (error) {
            console.error("Failed to save command", error);
            toast.error("Failed to save inventory update");
        }

        setIsDialogOpen(false);
        setParsedCommand(null);
    };

    const [isUploading, setIsUploading] = useState(false);

    // Client-side Resize to avoid 4MB Limits and slow uploads
    const resizeImage = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    // Compress to JPEG 0.7 quality
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        toast.info("Compressing & Analyzing...");

        try {
            // 1. Resize/Compress (Critical for mobile photos > 5MB)
            const base64 = await resizeImage(file);

            // 2. Call Server Action
            const result = await analyzeImageAction(base64);

            // 3. Populate Dialog
            if (result) {
                setParsedCommand(result);
                setIsDialogOpen(true);
                toast.success(`Identified: ${result.item}`);
            }
            setIsUploading(false);

        } catch (error: any) {
            console.error("Analysis failed", error);
            // Check for specific vercel timeouts or size limits
            if (error.message?.includes("body size")) {
                toast.error("Image too large, even after compression.");
            } else {
                toast.error("Failed to analyze. Check Vercel Logs.");
            }
            setIsUploading(false);
        } finally {
            e.target.value = '';
        }
    };

    // Fix 0 Bug: Helper to handle quantity changes
    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val === '') {
            // Allow empty temporarily by setting to 0 (or we could use a separate state if needed, 
            // but for now 0 is safe as long as we don't block typing)
            // Actually, best way is to cast to number, but if it's empty, we might need a separate 'string' state 
            // to allow full deletion. 
            // SIMPLER: use type="text" and manually validate.
            setParsedCommand(prev => prev ? { ...prev, quantity: 0 } : null);
        } else {
            setParsedCommand(prev => prev ? { ...prev, quantity: parseInt(val) || 0 } : null);
        }
    };

    if (!hasRecognitionSupport) {
        return null;
    }

    return (
        <>
            {/* LEFT SIDE: Camera Button */}
            <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-2 pointer-events-none">
                {/* Uploading State Badge */}
                {isUploading && (
                    <div className="bg-card border border-border text-card-foreground px-4 py-2 rounded-lg mb-2 text-sm shadow animate-in fade-in slide-in-from-bottom-2 font-medium">
                        <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Analyzing...</span>
                    </div>
                )}

                <div className="pointer-events-auto relative">
                    <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        id="camera-input"
                        onChange={handleImageUpload}
                        disabled={isUploading || processing}
                    />
                    <Button
                        size="lg"
                        className={cn(
                            "h-16 w-16 rounded-full shadow-xl border-4 border-background transition-all duration-300",
                            "bg-secondary text-secondary-foreground hover:bg-secondary/90"
                        )}
                        onClick={() => document.getElementById('camera-input')?.click()}
                        disabled={isUploading || processing}
                    >
                        <Camera className="h-8 w-8" />
                    </Button>
                </div>
            </div>

            {/* RIGHT SIDE: Mic Button & Status */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 pointer-events-none">
                {(isListening || processing) && (
                    <div className="bg-card border border-border text-card-foreground px-4 py-2 rounded-lg mb-2 max-w-[250px] text-sm shadow animate-in fade-in slide-in-from-bottom-2 font-medium">
                        {processing ? <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Processing...</span> :
                            (transcript || "Listening...")}
                    </div>
                )}

                <div className="pointer-events-auto">
                    <Button
                        size="lg"
                        onClick={handleToggleListening}
                        className={cn(
                            "h-16 w-16 rounded-full shadow-xl border-4 border-background transition-all duration-300",
                            isListening ? "bg-white text-primary hover:bg-gray-100 animate-pulse" : "bg-primary hover:bg-primary/90"
                        )}
                    >
                        {processing ? (
                            <Loader2 className="h-8 w-8 animate-spin" />
                        ) : isListening ? (
                            <Square className="h-6 w-6 fill-current" />
                        ) : (
                            <Mic className="h-8 w-8" />
                        )}
                    </Button>
                </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                {/* Mobile: Full Screen Edge-to-Edge. Desktop: Centered Modal */}
                <DialogContent className="fixed z-50 gap-0 p-0 shadow-lg bg-card 
                    w-full h-full top-0 left-0 translate-x-0 translate-y-0 rounded-none border-none
                    sm:max-w-md sm:h-auto sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border
                    animate-in fade-in zoom-in-95 duration-200 flex flex-col">

                    <DialogHeader className="p-6 pb-4 bg-gradient-to-b from-card to-card/95 border-b border-border/40 flex-shrink-0">
                        <DialogTitle className="text-xl">Confirm Action</DialogTitle>
                        <DialogDescription>
                            {parsedCommand?.originalTranscript ? `"${parsedCommand.originalTranscript}"` : "Review the parsed details."}
                        </DialogDescription>
                    </DialogHeader>

                    {parsedCommand && (
                        <div className="flex-1 overflow-y-auto p-6 py-4">
                            <div className="flex items-center gap-4 mb-6">
                                <Badge variant={parsedCommand.type === 'REMOVE' ? 'destructive' : parsedCommand.type === 'MOVE' ? 'secondary' : 'default'} className="text-lg py-1 px-4">
                                    {parsedCommand.type}
                                </Badge>
                            </div>

                            <div className="grid gap-8"> {/* Increased gap for uniform spacing */}
                                <div className="grid gap-3">
                                    <Label htmlFor="item" className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Item Name</Label>
                                    <Input
                                        id="item"
                                        defaultValue={parsedCommand.item}
                                        className="text-lg h-14 px-4 bg-secondary/20 border-transparent focus:border-primary transition-all"
                                        onChange={(e) => setParsedCommand({ ...parsedCommand, item: e.target.value })}
                                    />
                                </div>

                                <div className="grid gap-3">
                                    <Label htmlFor="qty" className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Quantity</Label>
                                    <div className="flex items-center gap-3">
                                        <Input
                                            id="qty"
                                            type="number"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            value={parsedCommand.quantity === 0 ? '' : (parsedCommand.quantity || 0).toString()}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setParsedCommand({ ...parsedCommand, quantity: val === '' ? 0 : Number(val) })
                                            }}
                                            className="text-lg h-14 w-32 bg-secondary/20 border-transparent focus:border-primary transition-all"
                                        />
                                        <span className="text-sm font-medium text-muted-foreground">Units</span>
                                    </div>
                                </div>

                                {/* MOVE: Source & Destination */}
                                {parsedCommand.type === 'MOVE' && (
                                    <>
                                        <div className="grid gap-3">
                                            <Label htmlFor="from" className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Source Location</Label>
                                            <Input
                                                id="from"
                                                defaultValue={parsedCommand.fromLocation || ''}
                                                placeholder="From (e.g. Van)"
                                                className="h-14 bg-secondary/20 border-transparent text-lg"
                                                onChange={(e) => setParsedCommand({ ...parsedCommand, fromLocation: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid gap-3">
                                            <Label htmlFor="to" className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Destination</Label>
                                            <Input
                                                id="to"
                                                defaultValue={parsedCommand.toLocation || ''}
                                                placeholder="To (e.g. Bin A)"
                                                className="h-14 bg-secondary/20 border-transparent text-lg"
                                                onChange={(e) => setParsedCommand({ ...parsedCommand, toLocation: e.target.value })}
                                            />
                                        </div>
                                    </>
                                )}

                                {/* ADD: Target Location */}
                                {parsedCommand.type === 'ADD' && (
                                    <div className="grid gap-3">
                                        <Label htmlFor="loc" className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Location</Label>
                                        <Input
                                            id="loc"
                                            defaultValue={parsedCommand.location || ''}
                                            placeholder="Location (Optional)"
                                            className="h-14 bg-secondary/20 border-transparent text-lg"
                                            onChange={(e) => setParsedCommand({ ...parsedCommand, location: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="p-6 bg-card border-t border-border/40 mt-auto flex-shrink-0 sm:mt-0">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1 h-12 text-base">Cancel</Button>
                        <Button type="submit" onClick={handleConfirm} className="flex-1 h-12 text-base font-semibold shadow-lg shadow-primary/20">
                            Confirm <Check className="w-4 h-4 ml-2" />
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
