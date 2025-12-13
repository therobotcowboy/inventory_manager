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
      You are an inventory assistant for a handyman named Joe. 
      Parse the following voice command into a structured JSON object.
      
      Command: "${transcript}"

      Output structure:
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

      Rules:
      1. INTENT DETECTION:
         - "Used", "Took", "Installed", "Consumed" -> REMOVE
         - "Bought", "Got", "Restocked", "Add" -> ADD
         - "Put", "Moved", "Transfer" -> MOVE
         - "Where is", "Do I have", "Show me", "Check" -> QUERY

      2. DISAMBIGUATION (Critical):
         - If the item is generic (e.g., "Screws", "Nails", "Paint") and the text implies NO specific type, you MUST ask for clarification.
         - Set "requires_clarification": true
         - Set "clarification_question": e.g. "Which type of screws? Wood or Drywall?"
         - However, if the command has context (e.g. "Drywall screws"), do NOT ask.

      3. JOB CONTEXT:
         - If the user mentions a job, site, or project (e.g., "at Smith House", "for the downtown job"), extract it to "job_reference".

      4. UNIT OF MEASURE:
         - Extract units like "Box", "Pack", "Roll", "Bag" into the "unit" field.
         - Example: "Add 2 boxes of screws" -> quantity=2, unit="Box".

      5. LOCATION HIERARCHY:
     - If the user specifies a sub-location (e.g. "in the Van, top drawer"), combine them with " > ".
     - Example: "Add to Van in Drawer 1" -> location="Van > Drawer 1".
     - Example: "Put this in the Garage on Shelf A" -> location="Garage > Shelf A".

      6. MISSING INFORMATION (STRICT):
         - For "ADD" commands, we need to know WHERE and HOW MANY.
         - If 'quantity' is missing (implied 1 is okay, but explicit is better) AND 'location' is missing, ask!
         - Actually, better rule: If the user says "Add [Item]" with NO location and NO quantity, ask "How many and where?"
         - If they give quantity but no location (e.g. "Add 5 screws"), ask "Where should I put them?"
         - If they give location but no quantity (e.g. "Add screws to Van"), default quantity to 1 is acceptable, or ask "How many?" (Let's default qty to 1 if location is present, but if NOTHING is present, ask).

      Refined Rules for Clarification:
      - Item Ambiguity? -> Ask.
      - ADD command missing Location? -> Ask "Where do those go?" (Set requires_clarification=true)
      - ADD command missing Quantity? -> Default to 1, UNLESS Location is ALSO missing.

      Specific Examples:
      - "Add sink gaskets": item="sink gaskets", location=null -> requires_clarification=true, clarification_question="Where should I put the sink gaskets, and how many?"
      - "Add 5 screws to Bin A": item="screws" generic? -> requires_clarification=true, clarification_question="Which type of screws?"
      - "Add 5 Wood Screws to Bin A": type=ADD, item="Wood Screws", quantity=5, location="Bin A"
      - "Add 10 nails to Van in Drawer B": type=ADD, item="nails", quantity=10, location="Van > Drawer B"
      - "Used 3 packs of shims at the Smith House": type=REMOVE, item="shims", quantity=3, unit="packs", job_reference="Smith House"
      - "Move the drill to the van": type=MOVE, item="drill", toLocation="van"
      
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
                unit: parsed.unit,                  // New
                location: parsed.location,
                fromLocation: parsed.fromLocation,
                toLocation: parsed.toLocation,
                job_reference: parsed.job_reference, // New
                requires_clarification: parsed.requires_clarification, // New
                clarification_question: parsed.clarification_question, // New
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
