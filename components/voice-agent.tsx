"use client"

import { useState, useEffect, useRef } from 'react';
import { Mic, Square, Loader2, Check, Camera, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { parseVoiceCommandAction, analyzeImageAction } from '@/app/actions';
import { ParsedVoiceCommand, ParsedCommandResult } from '@/lib/types';
import { cn } from '@/lib/utils';
import { db } from '@/lib/db';
import { processOfflineQueue } from '@/lib/sync-engine';
import { InventoryService } from '@/lib/inventory-service';

export function VoiceAgent() {
    const { isListening, transcript, startListening, stopListening, resetTranscript, hasRecognitionSupport } = useSpeechRecognition();

    const [processing, setProcessing] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const [clarificationContext, setClarificationContext] = useState<string | null>(null);

    const [messages, setMessages] = useState<{ role: 'user' | 'assistant', text: string }[]>([]);
    const [inputValue, setInputValue] = useState("");

    // Use a reference to track if we should process on stop
    const shouldProcessRef = useRef(false);

    useEffect(() => {
        if (isListening) {
            shouldProcessRef.current = true;
        } else if (shouldProcessRef.current && transcript) {
            shouldProcessRef.current = false;
            handleProcess(transcript);
        }
    }, [isListening, transcript]);

    /**
     * Helper: Check if specific item name is ambiguous in DB
     */
    const checkDbAmbiguity = async (itemName: string): Promise<boolean> => {
        if (!itemName) return false;
        const allItems = await db.items.toArray();
        const normalize = (s: string) => s.toLowerCase();
        const query = normalize(itemName);

        // 1. Exact Match?
        const exact = allItems.find(i => normalize(i.name) === query);
        if (exact) return false;

        // 2. Partial Matches
        const matches = allItems.filter(i => normalize(i.name).includes(query));
        return matches.length > 1;
    };

    const handleProcess = async (textOverride?: string) => {
        const textToProcess = textOverride || inputValue;
        if (!textToProcess) return;

        setProcessing(true);
        setMessages(prev => [...prev, { role: 'user', text: textToProcess }]);
        setInputValue("");
        resetTranscript();

        try {
            let cmdText = textToProcess;
            if (clarificationContext) {
                cmdText = `Original Context: "${clarificationContext}". User clarification: "${cmdText}"`;
            }

            // 1. Parse
            const result = await parseVoiceCommandAction(cmdText);
            const { commands } = result;

            // 2. Execution Plans
            let completedMsgs: string[] = [];
            let errorMsgs: string[] = [];
            let pendingQuestion = "";
            let newClarificationContext = clarificationContext;

            // Sequential Loop - "Try/Catch per item" to prevent one failure from stopping the chain
            for (const cmd of commands) {
                try {
                    // A. Check Ambiguity
                    let isAmbiguous = cmd.requires_clarification;
                    let question = cmd.clarification_question;

                    if (!isAmbiguous && cmd.type !== 'QUERY') {
                        const dbAmbiguous = await checkDbAmbiguity(cmd.item);
                        if (dbAmbiguous) {
                            isAmbiguous = true;
                            question = `I have multiple types of "${cmd.item}". Which one did you mean?`;
                        }
                    }

                    if (isAmbiguous) {
                        // If we hit ambiguity, we pause HERE.
                        // We typically can't "skip" ambiguity in a dependency chain (e.g. Move the X I just bought), 
                        // but for "List of Actions", we can do the others?
                        // User Rule: "Do not execute NEEDS_CLARIFICATION... Ask pending."
                        // We will log it as pending and NOT execute.
                        pendingQuestion = question || "I need clarification.";
                        newClarificationContext = cmdText; // Restore full context for retry
                    } else {
                        // B. Execute Valid
                        console.log("Executing:", cmd);
                        await InventoryService.processCommand(cmd);

                        let msg = "";
                        if (cmd.type === 'ADD') msg = `✅ Added ${cmd.item}`;
                        if (cmd.type === 'REMOVE') msg = `✅ Removed ${cmd.item}`;
                        if (cmd.type === 'MOVE') msg = `✅ Moved ${cmd.item}`;
                        if (cmd.type === 'QUERY') msg = `🔎 Checked ${cmd.item}`;

                        if (msg) completedMsgs.push(msg);
                    }
                } catch (innerError: any) {
                    console.error("Command Error:", cmd, innerError);
                    errorMsgs.push(`❌ Failed to ${cmd.type} ${cmd.item}: ${innerError.message}`);
                }
            }

            // 3. Batched Response
            if (completedMsgs.length > 0) {
                setMessages(prev => [...prev, { role: 'assistant', text: completedMsgs.join('\n') }]);
            }
            if (errorMsgs.length > 0) {
                setMessages(prev => [...prev, { role: 'assistant', text: errorMsgs.join('\n') }]);
            }

            await processOfflineQueue();

            // 4. Handle Pending / Finish
            if (pendingQuestion) {
                setMessages(prev => [...prev, { role: 'assistant', text: `🛑 ${pendingQuestion}` }]);
                setClarificationContext(newClarificationContext);
                setIsDialogOpen(true);
                setTimeout(() => startListening(), 200);
            } else {
                // Success
                if (completedMsgs.length > 0) {
                    toast.success("Processed successfully");
                }
                setClarificationContext(null);
                setTimeout(() => {
                    setIsDialogOpen(false);
                    setMessages([]);
                }, 2500);
            }

        } catch (e: any) {
            console.error("AI Context Error", e);
            setMessages(prev => [...prev, { role: 'assistant', text: "Sorry, critical error processing command." }]);
        } finally {
            setProcessing(false);
        }
    };

    const handleMicClick = () => {
        if (isListening) {
            stopListening();
        } else {
            setIsDialogOpen(true);
            resetTranscript();
            startListening();
        }
    };

    // If dialog closes, reset
    useEffect(() => {
        if (!isDialogOpen) {
            setMessages([]);
            setClarificationContext(null);
            resetTranscript();
        }
    }, [isDialogOpen, resetTranscript]);


    const [isUploading, setIsUploading] = useState(false);

    // Client-side Resize
    const resizeImage = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800; const MAX_HEIGHT = 800;
                    let width = img.width; let height = img.height;
                    if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
                    else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
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
            const base64 = await resizeImage(file);
            const result = await analyzeImageAction(base64);

            if (result) {
                setMessages(prev => [...prev, { role: 'assistant', text: `I identified: ${result.item}.` }]);

                if (!result.requires_clarification) {
                    await InventoryService.processCommand(result);
                    processOfflineQueue();
                    setMessages(prev => [...prev, { role: 'assistant', text: `✅ Added ${result.item}` }]);
                    setTimeout(() => { setIsDialogOpen(false); setMessages([]); }, 1500);
                } else {
                    setMessages(prev => [...prev, { role: 'assistant', text: result.clarification_question || "Check details?" }]);
                    setClarificationContext(`Image of ${result.item}`);
                    setIsDialogOpen(true);
                }
            }
            setIsUploading(false);
        } catch (error: any) {
            console.error("Analysis failed", error);
            toast.error("Failed to analyze.");
            setIsUploading(false);
        } finally {
            e.target.value = '';
        }
    };

    if (!hasRecognitionSupport) return null;

    return (
        <>
            {/* LEFT SIDE: Camera */}
            <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-2 pointer-events-none pb-[env(safe-area-inset-bottom)]">
                {isUploading && (
                    <div className="bg-card border border-border text-card-foreground px-4 py-2 rounded-lg mb-2 text-sm shadow animate-in fade-in slide-in-from-bottom-2 font-medium">
                        <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Analyzing...</span>
                    </div>
                )}
                <div className="pointer-events-auto relative">
                    <input type="file" accept="image/*" capture="environment" className="hidden" id="camera-input" onChange={handleImageUpload} disabled={isUploading || processing} />
                    <Button size="lg" className="h-16 w-16 rounded-full shadow-xl border-4 border-background bg-[var(--im-orange-deep)] text-white hover:opacity-90" onClick={() => document.getElementById('camera-input')?.click()} disabled={isUploading || processing}>
                        <Camera className="h-8 w-8" />
                    </Button>
                </div>
            </div>

            {/* RIGHT SIDE: Mic */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-4 pointer-events-none pb-[env(safe-area-inset-bottom)]">
                <div className="pointer-events-auto">
                    <Button size="lg" onClick={handleMicClick} className={cn("h-16 w-16 rounded-full shadow-xl border-4 border-background transition-all duration-300", isListening ? "bg-red-500 animate-pulse" : "bg-[var(--im-orange-deep)]")}>
                        {isListening ? <Square className="h-6 w-6 fill-current" /> : <Mic className="h-8 w-8" />}
                    </Button>
                </div>
            </div>

            {/* CHAT DIALOG */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="fixed z-[100] gap-0 p-0 bg-background w-screen h-[100dvh] max-w-none max-h-none m-0 rounded-none border-none flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="p-6 bg-background/80 backdrop-blur-md border-b border-border flex items-center justify-between shrink-0 sticky top-0 z-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
                        <span className="font-semibold text-2xl flex items-center gap-3">
                            <span className={cn("w-3 h-3 rounded-full transition-colors duration-500", isListening ? "bg-red-500 animate-ping" : "bg-green-500")} />
                            Joe's Agent
                        </span>
                        <Button size="icon" variant="ghost" onClick={() => setIsDialogOpen(false)} className="h-12 w-12 rounded-full hover:bg-secondary/20">
                            <X className="h-6 w-6" />
                        </Button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-secondary/5">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
                                <Mic className="w-12 h-12 mb-2" />
                                <p>Listening...</p>
                            </div>
                        )}
                        {messages.map((m, i) => (
                            <div key={i} className={cn("flex w-full", m.role === 'user' ? "justify-end" : "justify-start")}>
                                <div className={cn("max-w-[80%] p-3 rounded-2xl text-sm md:text-base shadow-sm", m.role === 'user' ? "bg-primary text-primary-foreground rounded-br-none" : "bg-card border text-card-foreground rounded-bl-none")}>
                                    <span className="whitespace-pre-line">{m.text}</span>
                                </div>
                            </div>
                        ))}
                        {isListening && transcript && (
                            <div className="flex w-full justify-end">
                                <div className="max-w-[80%] p-3 rounded-2xl rounded-br-none bg-primary/50 text-primary-foreground/80 animate-pulse italic">
                                    {transcript}...
                                </div>
                            </div>
                        )}
                        {processing && (
                            <div className="flex justify-start">
                                <div className="bg-card border p-3 rounded-2xl rounded-bl-none flex gap-1 items-center">
                                    <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"></span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <div className="p-4 bg-background border-t border-border mt-auto shrink-0 flex gap-2 items-end pb-[max(1rem,env(safe-area-inset-bottom))]">
                        <Input value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder="Type a message..." className="bg-secondary/20 border border-border focus-visible:ring-1 focus-visible:ring-primary/50 min-h-[44px] py-3 rounded-xl" onKeyDown={e => { if (e.key === 'Enter') handleProcess(); }} />
                        {inputValue ? (
                            <Button size="icon" onClick={() => handleProcess()} className="shrink-0 h-11 w-11 rounded-xl"><Check className="w-5 h-5" /></Button>
                        ) : (
                            <Button size="icon" variant={isListening ? "destructive" : "secondary"} onClick={handleMicClick} className="shrink-0 h-11 w-11 rounded-xl">
                                {isListening ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

// TODO: Move types and helpers if file grows too large, but for now this holds the Logic Loop.
