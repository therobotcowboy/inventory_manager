import { GoogleGenerativeAI } from '@google/generative-ai';
import { ParsedVoiceCommand } from './types';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

// Using 'gemini-1.5-flash' as it's the current fast/cost-effective standard.
// Note: 'gemini-2.5-flash' mentioned in PRD might be a future/beta ref, falling back to stable 1.5-flash
// Verified available model via debug script
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export const AiService = {
    parseVoiceCommand: async (transcript: string): Promise<ParsedVoiceCommand> => {
        if (!apiKey) {
            throw new Error("Missing GEMINI_API_KEY");
        }

        const prompt = `
      You are an inventory assistant for a handyman. 
      Parse the following voice command into a structured JSON object.
      
      Command: "${transcript}"

      Output structure:
      {
        "action": "ADD" | "REMOVE" | "MOVE" | "CHECK",
        "item_name": "string (standardized tool/part name)",
        "quantity": number,
        "source_location": "string (optional)",
        "destination_location": "string (optional)",
        "confidence": number (0-1)
      }

      Rules:
      - "Used", "Took", "Installed" -> REMOVE
      - "Bought", "Got", "Restocked" -> ADD
      - "Put", "Moved" -> MOVE
      - If quantity is missing, default to 1.
      - Return ONLY the JSON string, no markdown.
    `;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Clean up markdown code blocks if present
            const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();

            const parsed = JSON.parse(cleanJson);
            return {
                ...parsed,
                original_transcript: transcript
            } as ParsedVoiceCommand;

        } catch (error) {
            console.error("Gemini Parse Error:", error);
            throw error;
        }
    },
    async getRecommendations(inventory: any[], jobDescription: string): Promise<any> {
        if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

        const prompt = `
          You are an expert master tradesman. A junior tech is about to do a job: "${jobDescription}".
          
          Here is their current inventory (TOOLBOX/VAN):
          ${JSON.stringify(inventory.map(i => `${i.name} (Qty: ${i.quantity})`), null, 2)}

          Analyze the job requirements vs the inventory.
          Return a JSON object with a list of "missing_items" that they absolutely need but don't have (or have 0 of).
          
          Output Format:
          {
            "missing_items": [
               { "name": "Tool Name", "reason": "Why it is needed" }
            ],
            "advice": "Short energetic tip for the job"
          }

          Rules:
          - Only list ESSENTIAL missing items.
          - If they have it, DO NOT list it.
          - Return ONLY JSON.
        `;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (error) {
            console.error("Gemini Recs Error:", error);
            throw error;
        }
    }
};
