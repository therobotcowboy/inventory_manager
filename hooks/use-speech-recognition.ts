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

    useEffect(() => {
        if (typeof window !== 'undefined') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                setHasSupport(true);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = true; // Keep listening until stopped
                recognitionRef.current.interimResults = true; // Show results as you speak
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

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                recognitionRef.current.onerror = (event: any) => {
                    console.error('Speech recognition error', event.error);
                    if (event.error === 'not-allowed') {
                        toast.error("Microphone access denied. Please enable permission.");
                    } else if (event.error === 'no-speech') {
                        // failing silently is sometimes better for no-speech, but for debugging:
                        // toast.warning("No speech detected.");
                    } else {
                        toast.error(`Mic Error: ${event.error}`);
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
