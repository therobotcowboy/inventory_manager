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
        "type": "ADD" | "REMOVE" | "MOVE" | "QUERY",
        "item": "string (standardized tool/part name)",
        "quantity": number,
        "location": "string (for ADD: destination, for QUERY: context)",
        "fromLocation": "string (for MOVE: source)",
        "toLocation": "string (for MOVE: destination)",
        "confidence": number (0-1)
      }

      Rules:
      - "Used", "Took", "Installed" -> REMOVE
      - "Bought", "Got", "Restocked", "Add" -> ADD
      - "Put", "Moved", "Transfer" -> MOVE
      - "Where is", "Do I have", "Show me" -> QUERY
      
      Specific Examples:
      - "Add 5 screws to Bin A": type=ADD, item="screws", quantity=5, location="Bin A"
      - "Put the drill in the van": type=MOVE, item="drill", toLocation="van" (or ADD if clearly new stock, usually MOVE)
      - "Move 5 screws from Van to Bin A": type=MOVE, item="screws", quantity=5, fromLocation="Van", toLocation="Bin A"
      
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

            // Map to strict types if needed (though prompt asks for matching keys now)
            return {
                type: parsed.type,
                item: parsed.item,
                quantity: parsed.quantity,
                location: parsed.location,
                fromLocation: parsed.fromLocation,
                toLocation: parsed.toLocation,
                confidence: parsed.confidence,
                originalTranscript: transcript
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
    },
    async identifyItem(imageBase64: string): Promise<ParsedVoiceCommand> {
        if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

        const prompt = `
          You are an expert master tradesman. Look at this photo of a tool or part.
          Identify it precisely (e.g. "1/2 inch drill bit" or "Phillips head screwdriver").
          Estimate the quantity if possible (defaults to 1).
          
          Return a JSON object matching this structure:
          {
            "type": "ADD",
            "item": "string (name of item)",
            "quantity": number (count visible),
            "confidence": number (0-1)
          }
          
          Rules:
          - Return ONLY JSON.
          - If the image is unclear, set confidence low.
        `;

        try {
            // Gemini Vision requires specific format
            const imagePart = {
                inlineData: {
                    data: imageBase64,
                    mimeType: "image/jpeg"
                }
            };

            const result = await model.generateContent([prompt, imagePart]);
            const response = await result.response;
            const text = response.text();
            const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);

            return {
                type: 'ADD', // Default to ADD for found items
                item: parsed.item,
                quantity: parsed.quantity || 1,
                location: undefined, // Let user decide or we can default to unassigned
                confidence: parsed.confidence,
                originalTranscript: `Photo of ${parsed.item}`
            };
        } catch (error) {
            console.error("Gemini Vision Error:", error);
            throw error;
        }
    }
};
