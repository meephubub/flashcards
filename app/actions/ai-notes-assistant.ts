"use server";

import { getGroqApiKey } from "@/lib/api-keys";

export async function processNoteQuestion(
  noteContent: string,
  noteTitle: string | null,
  userQuestion: string
) {
  const groqApiKey = await getGroqApiKey();
  
  if (!groqApiKey) {
    throw new Error("GROQ_API_KEY is not defined in environment variables");
  }

  const systemMessage = `You are a helpful AI assistant for a note-taking application. 
Your job is to answer questions about notes and help edit them.
When providing edits, use the exact markdown format that's used in the notes.
When answering questions, be concise but thorough.`;

  const userMessage = `
Note Title: ${noteTitle || "Untitled Note"}

Note Content:
${noteContent}

User Question: ${userQuestion}
`;

  try {
    const payload = {
      model: "llama3-70b-8192",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      temperature: 0.5,
      max_tokens: 2048,
    };
    console.log("[GROQ DEBUG] Sending request to Groq API:", JSON.stringify(payload));

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorText = await response.text();
      console.error("[GROQ DEBUG] API request failed. Status:", response.status, response.statusText);
      console.error("[GROQ DEBUG] Response body:", errorText);
      throw new Error(`API request failed: ${errorText}`);
    }

    const data = await response.json();
    console.log("[GROQ DEBUG] API response:", JSON.stringify(data));
    return data.choices[0].message.content;
  } catch (error) {
    console.error("[GROQ DEBUG] Error in AI assistant:", error);
    throw new Error(`Failed to process your question: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Represents a single edit operation to be applied to a string.
 * - 'replace': Replaces text from startIndex to endIndex with new 'text'.
 * - 'insert': Inserts 'text' at startIndex.
 * - 'delete': Deletes text from startIndex to endIndex.
 */
export interface AIEditOperation {
  operation: "replace" | "insert" | "delete";
  startIndex: number;      // 0-based character index
  endIndex?: number;     // 0-based character index (exclusive), for 'replace' and 'delete'
  text?: string;         // New text for 'insert' or 'replace'
}

// Helper function to sanitize AI's JSON response
function sanitizeAiJsonResponse(jsonString: string): string {
  if (typeof jsonString !== 'string') return jsonString; // Should not happen if called correctly

  // Known issue: "operation": "delete, "startIndex" should be "operation": "delete", "startIndex"
  // This also handles "insert, " and "replace, " variants.
  // Regex breakdown:
  // ("operation":\s*") - Captures the prefix like "operation": "
  // (delete|insert|replace) - Captures the operation type
  // (,) - Captures the erroneous comma
  // (\s*"startIndex") - Captures the part like "startIndex"
  // The replacement puts a quote after the operation type and removes the erroneous comma.
  let sanitizedString = jsonString.replace(
    /("operation":\s*")(delete|insert|replace)(,)(\s*"startIndex")/g,
    '$1$2"$4' // Corrected: $1 -> "operation": ", $2 -> delete, " (closing quote), $4 -> "startIndex"
  );

  // Example: If AI sometimes wraps JSON in ```json ... ``` or similar
  // if (sanitizedString.startsWith("```json") && sanitizedString.endsWith("```")) {
  //   sanitizedString = sanitizedString.substring(7, sanitizedString.length - 3).trim();
  // } else if (sanitizedString.startsWith("```") && sanitizedString.endsWith("```")) {
  //   sanitizedString = sanitizedString.substring(3, sanitizedString.length - 3).trim();
  // }

  // Add more sanitization rules here if other common AI malformations are found.
  return sanitizedString;
}

export async function generateNoteEdits(
  noteContent: string,
  noteTitle: string | null,
  editInstruction: string
): Promise<AIEditOperation[]> {
  const groqApiKey = await getGroqApiKey();
  
  if (!groqApiKey) {
    throw new Error("GROQ_API_KEY is not defined in environment variables");
  }

  const systemMessage = `You are an advanced AI assistant for a note-taking application.
Your task is to analyze user edit instructions and the current note content, then generate a precise list of operations to achieve the desired edits.

You MUST return your response as a VALID JSON array of "edit operation" objects. Do NOT include any markdown formatting, backticks around the JSON, or any other text, explanations, or comments outside of the JSON array itself.
Each object in the array must conform to the following TypeScript interface:

interface AIEditOperation {
  operation: "replace" | "insert" | "delete"; // The type of edit
  startIndex: number;                           // The 0-based character index in the original note content where the operation begins.
  endIndex?: number;                            // The 0-based character index in the original note content where the operation ends (exclusive). Required for 'replace' and 'delete'.
  text?: string;                                // The new text to insert or replace with. Required for 'insert' and 'replace'.
}

Example 1: Original: "Hello world!", Instruction: "change world to planet"
Response: [ { "operation": "replace", "startIndex": 6, "endIndex": 11, "text": "planet" } ]

Example 2: Original: "Hello world!", Instruction: "insert beautiful before world"
Response: [ { "operation": "insert", "startIndex": 6, "text": "beautiful " } ]

Example 3: Original: "Hello world!", Instruction: "delete world!"
Response: [ { "operation": "delete", "startIndex": 6, "endIndex": 12 } ]

Example 4: Original: "Fix the speling mistake.", Instruction: "Correct 'speling' to 'spelling'"
Response: [ { "operation": "replace", "startIndex": 8, "endIndex": 15, "text": "spelling" } ]

IMPORTANT:
- ONLY return the raw JSON array of edit operations. No surrounding text or markdown.
- Character indices are 0-based.
- For 'replace' and 'delete', 'endIndex' marks the character *after* the last character to be affected.
- For 'insert', the 'text' is inserted *before* the character at 'startIndex'.
- If multiple changes are needed, return an array with multiple operation objects. Sort operations by startIndex in ascending order if possible, though the client will sort them in reverse for application.
- Ensure the JSON is strictly valid. For example, all strings must be in double quotes.
- Do not use trailing commas in objects or arrays.`;

  const userMessage = `
Note Title: ${noteTitle || "Untitled Note"}

Original Note Content:
${noteContent}

Edit Instruction: ${editInstruction}

Return ONLY the JSON array of edit operations as described in the system prompt. Do not include any other text or explanations.
`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage },
        ],
        temperature: 0.2,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API request failed: ${errorData.error?.message || response.statusText}`);
    }

    const rawData = await response.json();
    console.log("[GROQ DEBUG] Raw AI response for edits:", JSON.stringify(rawData));
    const aiResponseContent = rawData.choices[0]?.message?.content;

    if (!aiResponseContent) {
      console.error("[GROQ DEBUG] No content in AI response for edits");
      throw new Error("AI did not return any content for edits.");
    }

    // Sanitize the response content before attempting to parse
    const sanitizedContent = sanitizeAiJsonResponse(aiResponseContent);
    if (sanitizedContent !== aiResponseContent) {
        console.log("[GROQ DEBUG] Original AI response content for edits:", aiResponseContent);
        console.log("[GROQ DEBUG] Sanitized AI response content for edits:", sanitizedContent);
    }

    try {
      // Attempt to parse the SANITIZED content as JSON.
      const operations: AIEditOperation[] = JSON.parse(sanitizedContent);
      console.log("[GROQ DEBUG] Parsed AI operations:", JSON.stringify(operations));
      // Basic validation of the parsed structure (can be expanded)
      if (!Array.isArray(operations) || operations.some(op => !op.operation || typeof op.startIndex !== 'number')) {
        console.error("[GROQ DEBUG] Parsed operations (from sanitized content) do not match expected format. Sanitized content was:", sanitizedContent.substring(0,500));
        throw new Error(`AI response for edits, after sanitization, was not in the expected JSON array format or lacked required fields. Original content prefix: ${aiResponseContent ? aiResponseContent.substring(0,200) : "N/A"}...`);
      }
      return operations;
    } catch (parseError) {
      console.error("[GROQ DEBUG] Failed to parse AI response for edits as JSON.");
      console.error("[GROQ DEBUG] Original Content was:", aiResponseContent);
      if (sanitizedContent !== aiResponseContent && aiResponseContent) {
        console.error("[GROQ DEBUG] Sanitized Content (which still failed to parse) was:", sanitizedContent);
      }
      console.error("[GROQ DEBUG] Parse error:", parseError);
      // The error message to the client should refer to the original, as that's what the AI sent.
      throw new Error(`AI response for edits was not valid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}. Original Response: ${aiResponseContent ? aiResponseContent.substring(0, 200) : "N/A"}...`);
    }
  } catch (error) {
    console.error("[GROQ DEBUG] Error in generateNoteEdits:", error);
    // Ensure the error message passed to the client is not too verbose or leaks sensitive details if it's an API error.
    if (error instanceof Error && error.message.startsWith('API request failed')) {
        throw new Error('Failed to generate edits due to an API issue.'); // Generic message for API failures
    } else if (error instanceof Error && error.message.startsWith('AI response for edits was not valid JSON')) {
        throw error; // Propagate JSON parsing errors as they are informative
    } else if (error instanceof Error && error.message.startsWith('AI did not return any content')) {
        throw error; // Propagate no content errors
    } else if (error instanceof Error && error.message.startsWith('AI response for edits was not in the expected JSON array format')) {
        throw error; // Propagate format errors
    }
    throw new Error(`Failed to generate edits: ${error instanceof Error ? error.message : 'An unknown error occurred'}`);
  }
}
