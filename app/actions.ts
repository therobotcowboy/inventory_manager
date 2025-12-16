'use server'

import { AiService } from '@/lib/gemini';
import { ParsedVoiceCommand, ParsedCommandResult } from '@/lib/types';

export async function parseVoiceCommandAction(transcript: string): Promise<ParsedCommandResult> {
    // Server-side execution keeps the API Key hidden
    return await AiService.parseVoiceCommand(transcript);
}

export async function getJobRecommendationsAction(jobDescription: string) {
    return await AiService.getIdealLoadout(jobDescription);
}

export async function analyzeImageAction(imageBase64: string): Promise<ParsedVoiceCommand> {
    // This runs on server, keeps keys safe.
    // Ensure base64 is clean (remove header if present)
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    return await AiService.identifyItem(cleanBase64);
}
