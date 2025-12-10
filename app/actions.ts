'use server'

import { AiService } from '@/lib/gemini';
import { ParsedVoiceCommand } from '@/lib/types';

export async function parseVoiceCommandAction(transcript: string): Promise<ParsedVoiceCommand> {
    // Server-side execution keeps the API Key hidden
    return await AiService.parseVoiceCommand(transcript);
}

export async function getJobRecommendationsAction(inventory: any[], jobDescription: string) {
    return await AiService.getRecommendations(inventory, jobDescription);
}
