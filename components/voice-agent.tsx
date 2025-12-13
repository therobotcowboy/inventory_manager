"use client"

import { useState, useEffect, useRef } from 'react';
import { Mic, Square, Loader2, Check, Camera, X } from 'lucide-react';
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
    // const [parsedCommand, setParsedCommand] = useState<ParsedVoiceCommand | null>(null); // No longer needed for the dialog form
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
            handleProcess(transcript); // Process the auto-stopped transcript
        }
    }, [isListening, transcript]);

    const handleProcess = async (textOverride?: string) => {
        const textToProcess = textOverride || inputValue;
        if (!textToProcess) return;

        setProcessing(true);
        // Add User Message to Chat
        setMessages(prev => [...prev, { role: 'user', text: textToProcess }]);
        setInputValue("");

        // Clear Transcript if it came from voice
        resetTranscript();

        try {
            let cmdText = textToProcess;

            // Context appending
            if (clarificationContext) {
                cmdText = `Original Request: "${clarificationContext}". User clarification: "${cmdText}"`;
            }

            const result = await parseVoiceCommandAction(cmdText);

            if (result.requires_clarification && result.clarification_question) {
                // System Ask
                setMessages(prev => [...prev, { role: 'assistant', text: result.clarification_question! }]);
                setClarificationContext(cmdText); // Update context chain
                // Re-open/Keep open dialog
                setIsDialogOpen(true);

                // Continuous Conversation: Auto-Listen for reply
                setTimeout(() => {
                    startListening();
                }, 100); // Small delay to ensure state updates
            } else {
                // Success
                setMessages(prev => [...prev, { role: 'assistant', text: `Got it. ${result.type} ${result.item} ${result.location ? 'to ' + result.location : ''}` }]);

                // EXECUTE
                await InventoryService.processCommand(result);

                // Trigger Sync
                processOfflineQueue();
                toast.success(`Processed: ${result.item}`);

                setClarificationContext(null);

                // Auto-Close after delay
                setTimeout(() => {
                    setIsDialogOpen(false);
                    setMessages([]); // Reset chat for next time? Or keep history? Resetting feels cleaner given "fresh start"
                }, 1500);
            }

        } catch (e: any) {
            console.error("AI Error", e);
            setMessages(prev => [...prev, { role: 'assistant', text: "Sorry, I ran into an error processing that." }]);
        } finally {
            setProcessing(false);
        }
    };

    const handleMicClick = () => {
        if (isListening) {
            stopListening();
            // processing triggered by effect
        } else {
            setIsDialogOpen(true); // Open UI immediately
            resetTranscript();
            startListening();
        }
    };

    // If dialog closes, reset everything
    useEffect(() => {
        if (!isDialogOpen) {
            setMessages([]);
            setClarificationContext(null);
            resetTranscript();
        }
    }, [isDialogOpen, resetTranscript]);


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
                // setParsedCommand(result); // Old way
                // setIsDialogOpen(true); // Old way
                setMessages(prev => [...prev, { role: 'assistant', text: `I identified: ${result.item}. Quantity: ${result.quantity || 'unknown'}.` }]);
                toast.success(`Identified: ${result.item}`);

                // Auto-execute if no clarification needed
                if (!result.requires_clarification) {
                    await InventoryService.processCommand(result);
                    processOfflineQueue();
                    toast.success(`Processed: ${result.item}`);
                    setTimeout(() => {
                        setIsDialogOpen(false);
                        setMessages([]);
                    }, 1500);
                } else {
                    setMessages(prev => [...prev, { role: 'assistant', text: result.clarification_question! }]);
                    setClarificationContext(`Image analysis for: ${result.item}`); // Use item as context for clarification
                    setIsDialogOpen(true);
                }
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
                            "bg-orange-500 text-white hover:bg-orange-600"
                        )}
                        onClick={() => document.getElementById('camera-input')?.click()}
                        disabled={isUploading || processing}
                    >
                        <Camera className="h-8 w-8" />
                    </Button>
                </div>
            </div>

            {/* RIGHT SIDE: Mic Button & Status */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-4 pointer-events-none">
                <div className="pointer-events-auto">
                    <Button
                        size="lg"
                        onClick={handleMicClick}
                        className={cn(
                            "h-16 w-16 rounded-full shadow-xl border-4 border-background transition-all duration-300",
                            isListening ? "bg-red-500 hover:bg-red-600 animate-pulse" : "bg-primary hover:bg-primary/90"
                        )}
                    >
                        {isListening ? <Square className="h-6 w-6 fill-current" /> : <Mic className="h-8 w-8" />}
                    </Button>
                </div>
            </div>

            {/* CHAT OVERLAY */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent
                    className="fixed z-[100] gap-0 p-0 bg-background w-screen h-screen max-w-none max-h-none m-0 rounded-none border-none flex flex-col overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200"
                    onOpenAutoFocus={e => e.preventDefault()}
                >
                    {/* HEADER */}
                    <div className="p-6 bg-background/80 backdrop-blur-md border-b border-border flex items-center justify-between shrink-0 sticky top-0 z-10">
                        <span className="font-semibold text-2xl flex items-center gap-3">
                            <span className={cn(
                                "w-3 h-3 rounded-full transition-colors duration-500",
                                isListening ? "bg-red-500 animate-ping" : "bg-green-500"
                            )} />
                            Joe's Agent
                        </span>
                        <Button size="icon" variant="ghost" onClick={() => setIsDialogOpen(false)} className="h-12 w-12 rounded-full hover:bg-secondary/20">
                            <X className="h-6 w-6" />
                        </Button>
                    </div>

                    {/* LISTEN OVERLAY (When listening) */}
                    {isListening && (
                        <div className="absolute top-20 left-0 w-full flex justify-center pointer-events-none z-0">
                            <div className="flex gap-1 h-12 items-end">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="w-2 bg-primary/20 rounded-full animate-bounce" style={{
                                        height: '100%',
                                        animationDuration: '1s',
                                        animationDelay: `${i * 0.1}s`
                                    }} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CHAT AREA */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-secondary/5">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
                                <Mic className="w-12 h-12 mb-2" />
                                <p>Listening...</p>
                            </div>
                        )}

                        {messages.map((m, i) => (
                            <div key={i} className={cn("flex w-full", m.role === 'user' ? "justify-end" : "justify-start")}>
                                <div className={cn(
                                    "max-w-[80%] p-3 rounded-2xl text-sm md:text-base shadow-sm",
                                    m.role === 'user'
                                        ? "bg-primary text-primary-foreground rounded-br-none"
                                        : "bg-card border text-card-foreground rounded-bl-none"
                                )}>
                                    {m.text}
                                </div>
                            </div>
                        ))}

                        {/* Live Transcript Bubble */}
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

                    {/* INPUT AREA */}
                    <div className="p-4 bg-background border-t border-border mt-auto shrink-0 flex gap-2 items-end">
                        <Input
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            placeholder="Type a message..."
                            className="bg-secondary/10 border-0 focus-visible:ring-1 focus-visible:ring-primary/20 min-h-[44px] py-3 rounded-xl"
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleProcess();
                            }}
                        />
                        {inputValue ? (
                            <Button size="icon" onClick={() => handleProcess()} className="shrink-0 h-11 w-11 rounded-xl">
                                <Check className="w-5 h-5" />
                            </Button>
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
