"use client"

import { useState } from 'react';
import { Mic, Square, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { parseVoiceCommandAction } from '@/app/actions';
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
            toast.success(`Updated ${parsedCommand.item_name}`);

        } catch (error) {
            console.error("Failed to save command", error);
            toast.error("Failed to save inventory update");
        }

        setIsDialogOpen(false);
        setParsedCommand(null);
    };

    if (!hasRecognitionSupport) {
        return null;
    }

    return (
        <>
            <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 pointer-events-none">
                {(isListening || processing) && (
                    <div className="bg-card border border-border text-card-foreground px-4 py-2 rounded-lg mb-2 max-w-[250px] text-sm shadow animate-in fade-in slide-in-from-bottom-2 font-medium">
                        {processing ? <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Processing...</span> : (transcript || "Listening...")}
                    </div>
                )}

                <Button
                    size="lg"
                    onClick={handleToggleListening}
                    className={cn(
                        "h-16 w-16 rounded-full shadow-xl border-4 border-background pointer-events-auto transition-all duration-300",
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

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Confirm Action</DialogTitle>
                        <DialogDescription>
                            {parsedCommand?.original_transcript ? `"${parsedCommand.original_transcript}"` : "Review the parsed details."}
                        </DialogDescription>
                    </DialogHeader>

                    {parsedCommand && (
                        <div className="grid gap-4 py-4">
                            <div className="flex items-center gap-4">
                                <Badge variant={parsedCommand.action === 'REMOVE' ? 'destructive' : 'default'} className="text-lg py-1 px-4">
                                    {parsedCommand.action}
                                </Badge>
                                <div className="flex-1"></div>
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="item" className="text-right">Item</Label>
                                <Input
                                    id="item"
                                    defaultValue={parsedCommand.item_name}
                                    className="col-span-3"
                                    onChange={(e) => setParsedCommand({ ...parsedCommand, item_name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="qty" className="text-right">Qty</Label>
                                <div className="col-span-3 flex items-center gap-2">
                                    <Input
                                        id="qty"
                                        type="number"
                                        defaultValue={parsedCommand.quantity}
                                        onChange={(e) => setParsedCommand({ ...parsedCommand, quantity: Number(e.target.value) })}
                                        className="w-24"
                                    />
                                    <span className="text-sm text-muted-foreground">Units</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex flex-row sm:justify-between gap-2">
                        <Button variant="secondary" onClick={() => setIsDialogOpen(false)} className="flex-1">Cancel</Button>
                        <Button type="submit" onClick={handleConfirm} className="flex-1">
                            Confirm <Check className="w-4 h-4 ml-2" />
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
