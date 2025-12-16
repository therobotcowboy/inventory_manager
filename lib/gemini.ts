import { GoogleGenerativeAI } from '@google/generative-ai';
import { ParsedVoiceCommand, ParsedCommandResult } from './types';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

// Using 'gemini-1.5-flash' as it's the current fast/cost-effective standard.
// Note: 'gemini-2.5-flash' mentioned in PRD might be a future/beta ref, falling back to stable 1.5-flash
// Verified available model via debug script
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export const AiService = {
    parseVoiceCommand: async (transcript: string): Promise<ParsedCommandResult> => {
        if (!apiKey) {
            throw new Error("Missing GEMINI_API_KEY");
        }
        const prompt = `
      You are an inventory assistant for a handyman named Joe. 
      Parse the following voice command into a list of structured JSON objects.
      
      Command: "${transcript}"

      Output structure:
      {
        "commands": [
            {
                "type": "ADD" | "REMOVE" | "MOVE" | "QUERY",
                "item": "string (standardized tool/part name)",
                "quantity": number,
                "unit": "string (e.g. 'Box', 'Pack', 'Roll') or null",
                "location": "string (for ADD: destination, for QUERY: context)",
                "fromLocation": "string (for MOVE: source)",
                "toLocation": "string (for MOVE: destination)",
                "job_reference": "string (e.g. 'Smith House') or null",
                "requires_clarification": boolean,
                "clarification_question": "string (only if requires_clarification is true)",
                "confidence": number (0-1)
            }
        ]
      }

      Rules:
      1. MULTI-STEP PARSING:
         - Split compound sentences (e.g. "Add a hammer to the van, then add screws to the workshop").
         - Return an item in the "commands" array for EACH distinct action.
      
      2. INTENT DETECTION:
         - "Used", "Took", "Installed", "Consumed" -> REMOVE
         - "Bought", "Got", "Restocked", "Add" -> ADD
         - "Put", "Moved", "Transfer" -> MOVE
         - "Where is", "Do I have", "Show me", "Check" -> QUERY

      3. DISAMBIGUATION (Critical):
         - If text is generic (e.g., "Screws") and context is missing, set "requires_clarification": true.
         - However, if the user provides context in a later part of the sentence, apply it if possible, OR split them.
      
      4. JOB CONTEXT:
         - Extract "at Smith House" to job_reference.

      5. UNIT OF MEASURE:
         - Extract "Box", "Pack" to unit.

      6. LOCATION HIERARCHY:
         - "Van, top drawer" -> "Van > Top Drawer".

      Refined Rules for Clarification:
      - Item Ambiguity? -> Ask.
      - ADD command missing Location? -> Ask "Where do those go?" (requires_clarification=true)
      - ADD command missing Quantity? -> Default to 1, UNLESS Location is ALSO missing.

      Output ONLY JSON.
    `;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Clean up markdown code blocks if present
            const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();

            const parsed = JSON.parse(cleanJson);

            // Ensure we have an array, even if LLM messes up structure slightly (robustness)
            const commandsArray = Array.isArray(parsed.commands) ? parsed.commands : [parsed];

            return {
                commands: commandsArray.map((cmd: any) => ({
                    type: cmd.type,
                    item: cmd.item || 'Unknown',
                    quantity: cmd.quantity,
                    unit: cmd.unit,
                    location: cmd.location,
                    fromLocation: cmd.fromLocation,
                    toLocation: cmd.toLocation,
                    job_reference: cmd.job_reference,
                    requires_clarification: cmd.requires_clarification,
                    clarification_question: cmd.clarification_question,
                    confidence: cmd.confidence,
                    originalTranscript: transcript
                }))
            };

        } catch (error) {
            console.error("Gemini Parse Error:", error);
            throw error;
        }
    },
    async getIdealLoadout(jobDescription: string): Promise<any> {
        if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

        const prompt = `
          You are an expert master tradesman. A junior tech is about to do a job: "${jobDescription}".
          
          Generate the IDEAL LOADOUT list of tools, parts, and consumables required to do this job professionally.
          
          Output Format:
          {
            "required_items": [
               { 
                 "name": "Standard Item Name", 
                 "reason": "Why it is needed",
                 "quantity_est": 1 
               }
            ],
            "advice": "Short energetic tip for the job"
          }

          Rules:
          - Be comprehensive but practical.
          - Use standard naming conventions (e.g. "Phillips Screwdriver", "Wire Nuts", "Drill").
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
