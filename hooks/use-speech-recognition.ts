import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

export interface UseSpeechRecognitionReturn {
    isListening: boolean;
    transcript: string;
    startListening: () => void;
    stopListening: () => void;
    resetTranscript: () => void;
    hasRecognitionSupport: boolean;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [hasSupport, setHasSupport] = useState(false);

    // Use a ref to hold the recognition instance
    const recognitionRef = useRef<any>(null);

    // Silence Detection: Auto-stop if no speech for 2 seconds (after initial speech)
    useEffect(() => {
        if (!isListening || !transcript) return;

        const timer = setTimeout(() => {
            if (transcript.length > 0) {
                // User stopped talking
                if (recognitionRef.current) {
                    recognitionRef.current.stop();
                    setIsListening(false);
                }
            }
        }, 2000); // 2 seconds silence

        return () => clearTimeout(timer);
    }, [transcript, isListening]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            // ... (keep existing setup)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                setHasSupport(true);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = true;
                recognitionRef.current.interimResults = true;
                recognitionRef.current.lang = 'en-US';

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                recognitionRef.current.onresult = (event: any) => {
                    let currentTranscript = '';
                    for (let i = 0; i < event.results.length; i++) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        currentTranscript += (event.results[i][0] as any).transcript;
                    }
                    setTranscript(currentTranscript);
                };

                // ... (keep onerror/onend)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                recognitionRef.current.onerror = (event: any) => {
                    console.error('Speech recognition error', event.error);
                    if (event.error === 'not-allowed') {
                        toast.error("Microphone access denied.");
                    } else if (event.error === 'no-speech') {
                        // ignore
                    } else {
                        // toast.error(`Mic Error: ${event.error}`); // Suppress loud errors
                    }
                    setIsListening(false);
                };

                recognitionRef.current.onend = () => {
                    setIsListening(false);
                };
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startListening = useCallback(() => {
        if (recognitionRef.current && !isListening) {
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch (error) {
                console.error("Error starting recognition:", error);
            }
        }
    }, [isListening]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    }, [isListening]);

    const resetTranscript = useCallback(() => {
        setTranscript('');
    }, []);

    return {
        isListening,
        transcript,
        startListening,
        stopListening,
        resetTranscript,
        hasRecognitionSupport: hasSupport,
    };
}
