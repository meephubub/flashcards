export interface GeneratedCard {
  front: string
  back: string
}

export interface GenerationResult {
  cards: GeneratedCard[]
  topic: string
}

export interface HintResult {
  hint: string
  level: number
}

export interface GradingResult {
  isCorrect: boolean
  score: number
  feedback: string
  explanation?: string
  suggestions?: string
  relatedConcepts?: string[]
}

export interface GeneratedNote {
  title: string;
  content: string; // Markdown formatted content
}

export interface MultipleChoiceQuestion {
  question: string;
  options: string[];
  correctAnswer: string; // Or index of correct answer
  explanation?: string; // Optional explanation for the correct answer
}

export interface MCQGenerationResult {
  mcqs: MultipleChoiceQuestion[];
  sourceNoteTitle?: string; // Optional: title of the note used as source
}

export async function generateFlashcards(topic: string, numberOfCards = 5): Promise<GenerationResult> {
  // Create a simpler, more direct prompt that's less likely to cause JSON parsing issues
  const prompt = `Generate ${numberOfCards} educational flashcards on the topic: "${topic}".
Each flashcard should include:

A clear, concise question on the front.

A comprehensive, informative answer on the back.

Format the response as a valid JSON object with a "cards" array.
Each item in the array should be an object with "front" and "back" string properties.

Keep the language simple and appropriate for learners.
Ensure the JSON is properly structured and free of syntax errors.

Example output:

{
  "cards": [
    {
      "front": "What is the capital of France?",
      "back": "The capital of France is Paris."
    }
  ]
}`

  try {
    // First attempt to generate flashcards
    const response = await makeGroqRequest(prompt)

    // Try to parse the JSON response
    let parsedContent
    try {
      parsedContent = JSON.parse(response)
      // If we successfully parsed JSON, process it
      return processFlashcardResponse(parsedContent, topic)
    } catch (error) {
      console.log("Failed to parse JSON response, attempting to fix format:", response)

      // If parsing failed, send a follow-up request to fix the format
      const fixPrompt = `The following response needs to be formatted as valid JSON with a "cards" array containing objects with "front" and "back" properties. Please convert this to proper JSON format:

${response}

Return ONLY valid JSON in this format:
{
  "cards": [
    {
      "front": "Question text",
      "back": "Answer text"
    },
    ...
  ]
}`

      try {
        // Make a second request to fix the formatting
        const fixedResponse = await makeGroqRequest(fixPrompt)

        try {
          // Try to parse the fixed response
          const fixedParsedContent = JSON.parse(fixedResponse)
          return processFlashcardResponse(fixedParsedContent, topic)
        } catch (secondError) {
          console.error("Failed to parse fixed JSON response:", fixedResponse)
          // If still failing, extract content manually
          return extractCardsManually(response, topic)
        }
      } catch (retryError) {
        console.error("Error in retry request:", retryError)
        return extractCardsManually(response, topic)
      }
    }
  } catch (error) {
    console.error("Error generating flashcards:", error)
    // Return a fallback result
    return createFallbackCards(topic)
  }
}

export async function generateHint(
  question: string,
  correctAnswer: string,
  questionType: string,
  hintLevel: number
): Promise<HintResult> {
  const prompt = `Generate a helpful hint for the following exam question. The hint should guide the student without giving away the answer directly.

Question: ${question}
Correct Answer: ${correctAnswer}
Question Type: ${questionType}
Hint Level: ${hintLevel + 1} (1 = subtle hint, 2 = more specific hint, 3 = detailed hint)

Generate a hint that:
- Is appropriate for the hint level (more specific as level increases)
- Helps guide the student's thinking
- Doesn't directly reveal the answer
- Is clear and concise
- Is relevant to the question type

Return the response as a JSON object with a "hint" string property.`

  try {
    const response = await makeGroqRequest(prompt, true)
    const parsedContent = JSON.parse(response)
    return {
      hint: parsedContent.hint || "Think carefully about the question and consider all aspects of the content.",
      level: hintLevel
    }
  } catch (error) {
    console.error("Error generating hint:", error)
    return {
      hint: "Think carefully about the question and consider all aspects of the content.",
      level: hintLevel
    }
  }
}

export async function gradeAnswerWithGroq(
  questionType: string,
  question: string,
  correctAnswer: string,
  userAnswer: string,
  options?: {
    adaptiveScoring?: boolean
    timePressure?: "low" | "medium" | "high"
    previousAnswers?: GradingResult[]
  }
): Promise<GradingResult> {
  const prompt = `Grade the following exam answer. Provide detailed feedback and suggestions for improvement.

Question Type: ${questionType}
Question: ${question}
Correct Answer: ${correctAnswer}
User's Answer: ${userAnswer}
${options?.adaptiveScoring ? "Adaptive Scoring: Enabled" : ""}
${options?.timePressure ? `Time Pressure: ${options.timePressure}` : ""}
${options?.previousAnswers ? `Previous Performance: ${JSON.stringify(options.previousAnswers)}` : ""}

Grade the answer based on:
1. Accuracy and completeness
2. Understanding of concepts
3. Clarity and coherence
4. Question type specific criteria

Return the response as a JSON object with the following properties:
{
  "isCorrect": boolean,
  "score": number (0-100),
  "feedback": string,
  "explanation": string (optional),
  "suggestions": string (optional),
  "relatedConcepts": string[] (optional)
}`

  try {
    const response = await makeGroqRequest(prompt, true)
    const parsedContent = JSON.parse(response)

    // Validate the response format
    if (typeof parsedContent.isCorrect !== 'boolean' || 
        typeof parsedContent.score !== 'number' || 
        typeof parsedContent.feedback !== 'string') {
      throw new Error('Invalid response format from Groq')
    }

    // Ensure score is between 0 and 100
    parsedContent.score = Math.max(0, Math.min(100, parsedContent.score))

    return {
      isCorrect: parsedContent.isCorrect,
      score: parsedContent.score,
      feedback: parsedContent.feedback,
      explanation: parsedContent.explanation,
      suggestions: parsedContent.suggestions,
      relatedConcepts: parsedContent.relatedConcepts
    }
  } catch (error) {
    console.error("Error grading answer with Groq:", error)
    // Fallback to basic grading if Groq fails
    return {
      isCorrect: userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim(),
      score: userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim() ? 100 : 0,
      feedback: "An error occurred while grading. Please try again.",
      explanation: "The grading service is temporarily unavailable.",
      suggestions: "Try submitting your answer again."
    }
  }
}

export async function generateNoteWithGroq(topic: string): Promise<GeneratedNote> {
  const prompt = `Generate a comprehensive and well-structured note on the topic: "${topic}".

The note should include:
- A concise and informative title that summarizes the topic.
- Rich markdown content with a clear structure and logical flow.

## Supported Markdown Formatting (use all of these):

### Headings
- Use # for main title (h1)
- Use ## for major sections (h2) 
- Use ### for subsections (h3)
- Use #### and ##### for smaller headings when needed

### Lists
- Bullet lists with * or - at the start of line
- Numbered lists with 1., 2., etc.

### Text Formatting
- **Bold text** using double asterisks
- *Italic text* using single asterisks
- ~~Strikethrough~~ using double tildes
- ==Highlighted text== using double equals (for important terms or concepts)
- \`inline code\` using backticks for technical terms or commands

### Block Elements
- > Blockquotes for quotes or important callouts
- Horizontal rules with --- for section dividers
- Code blocks with triple backticks (\`\`\` ... \`\`\`)
- Centered text with double colons (::centered text::)

### Links
- [Link text](URL) syntax for references

Ensure the content is detailed, accurate, and organized in a way that facilitates learning. Break complex concepts into digestible sections and use diverse formatting elements to emphasize key points.

Format the response as a valid JSON object with "title" (string) and "content" (string, Markdown formatted) properties.

Example output:
{
  "title": "Key Concepts of Photosynthesis",
  "content": "# Photosynthesis: The Foundation of Life\\n\\n## Introduction\\nPhotosynthesis is a vital process...\\n\\n### Reactants\\n- Water (H2O)\\n- Carbon Dioxide (CO2)\\n\\n### Products\\n- Glucose (C6H12O6)\\n- Oxygen (O2)\\n\\n> This process is fundamental to life on Earth, providing both oxygen and energy.\\n\\n## Chemical Equation\\n\`6CO2 + 6H2O + light → C6H12O6 + 6O2\`\\n\\n---\\n\\n## Key Stages\\n1. Light-dependent reactions\\n2. Calvin cycle (light-independent reactions)\\n\\n### Light-Dependent Reactions\\n==These reactions convert light energy to chemical energy==\\n\\n\`\`\`\\nStage 1: Photon absorption by chlorophyll\\nStage 2: Electron transport chain\\nStage 3: ATP synthesis\\n\`\`\`\\n\\n::The miracle of converting sunlight to chemical energy::"
}`;
  const systemMessage = "You are an expert content creator specializing in generating well-structured and informative notes in Markdown format. Your output must always be a valid JSON object with 'title' and 'content' (Markdown) properties. Ensure the Markdown is clean and follows standard conventions. Incorporate all the specific Markdown formatting elements requested in the prompt to create rich, visually engaging notes.";

  try {
    // First attempt to generate the note
    const response = await makeGroqRequest(prompt, false, systemMessage);

    let parsedContent;
    try {
      parsedContent = JSON.parse(response);
      if (parsedContent && typeof parsedContent.title === 'string' && typeof parsedContent.content === 'string') {
        return {
          title: parsedContent.title,
          content: parsedContent.content
        };
      }
      throw new Error("Invalid note structure in JSON response");
    } catch (error) {
      console.log("Failed to parse JSON for note, attempting to fix format:", response);

      const fixPrompt = `The following response needs to be formatted as valid JSON with "title" and "content" (Markdown) properties. Please convert this to proper JSON format:\n\n${response}\n\nReturn ONLY valid JSON in this format:\n{\n  "title": "Note Title",\n  "content": "Markdown content..."\n}
`;
      let fixedResponse: string = "[No response from fix attempt]"; // Initialize fixedResponse
      try {
        fixedResponse = await makeGroqRequest(fixPrompt, false, "You are a JSON formatting expert. Convert the provided text into the specified JSON structure with 'title' and 'content' fields. Ensure content is valid Markdown.");
        const fixedParsedContent = JSON.parse(fixedResponse);
        if (fixedParsedContent && typeof fixedParsedContent.title === 'string' && typeof fixedParsedContent.content === 'string') {
          return {
            title: fixedParsedContent.title,
            content: fixedParsedContent.content
          };
        }
        throw new Error("Invalid note structure in fixed JSON response");
      } catch (secondError) {
        console.error("Failed to parse fixed JSON for note:", secondError, fixedResponse);
        // If still failing, create a fallback note
        return {
          title: `Note on ${topic} (Generation Failed)`,
          content: `Failed to generate content for "${topic}" after multiple attempts. Please try again or check the logs.`
        };
      }
    }
  } catch (error) {
    console.error("Error generating note with Groq:", error);
    return {
      title: `Note on ${topic} (Error)`,
      content: `An error occurred while trying to generate a note for "${topic}". Please check the console for more details.`
    };
  }
}

export async function generateMultipleChoiceQuestionsWithGroq(noteContent: string, noteTitle?: string, numberOfQuestions = 3): Promise<MCQGenerationResult> {
  const prompt = `Based on the following note content, generate ${numberOfQuestions} multiple-choice questions (MCQs). Each question should test understanding of key concepts from the note.

Note Title (for context, if available): "${noteTitle || 'Untitled Note'}"

Note Content:
"""
${noteContent}
"""

For each MCQ, provide:
1.  A clear question.
2.  An array of 4 distinct options (strings). One option must be the correct answer.
3.  The correct answer as a string (must exactly match one of the options).
4.  A brief explanation for why the answer is correct (optional, but encouraged).

Format the response as a valid JSON object with an "mcqs" array. Each item in the array should be an object with "question" (string), "options" (array of strings), "correctAnswer" (string), and "explanation" (string, optional) properties.

Example output:
{
  "mcqs": [
    {
      "question": "What is the primary function of mitochondria?",
      "options": [
        "Protein synthesis",
        "Energy production (ATP)",
        "Waste breakdown",
        "Cellular movement"
      ],
      "correctAnswer": "Energy production (ATP)",
      "explanation": "Mitochondria are known as the powerhouses of the cell because they generate most of the cell's supply of adenosine triphosphate (ATP), used as a source of chemical energy."
    }
  ]
}
`;

  const systemMessage = "You are an expert in creating educational multiple-choice questions based on provided text. Your output must always be a valid JSON object with an 'mcqs' array, where each MCQ has 'question', 'options', 'correctAnswer', and optionally 'explanation' fields. Ensure the options are plausible and the correct answer is clearly identifiable from the note content.";

  try {
    const response = await makeGroqRequest(prompt, false, systemMessage);
    let parsedContent;
    try {
      parsedContent = JSON.parse(response);
      if (parsedContent && Array.isArray(parsedContent.mcqs)) {
        // Basic validation for each MCQ structure
        const validMcqs = parsedContent.mcqs.filter((mcq: any) => 
          mcq &&
          typeof mcq.question === 'string' &&
          Array.isArray(mcq.options) &&
          mcq.options.length === 4 && 
          mcq.options.every((opt: any) => typeof opt === 'string') &&
          typeof mcq.correctAnswer === 'string' &&
          mcq.options.includes(mcq.correctAnswer) &&
          (typeof mcq.explanation === 'string' || typeof mcq.explanation === 'undefined')
        );

        if (validMcqs.length === 0 && parsedContent.mcqs.length > 0) {
          // Some MCQs were generated but didn't pass validation
          console.warn("Some MCQs failed validation:", parsedContent.mcqs);
          // Potentially try to fix them or return a partial result if needed in future
        }

        return {
          mcqs: validMcqs,
          sourceNoteTitle: noteTitle
        };
      }
      throw new Error("Invalid MCQ structure in JSON response or no MCQs generated.");
    } catch (error) {
      console.log("Failed to parse JSON for MCQs, attempting to fix format:", response, error);
      const fixPrompt = `The following response needs to be formatted as valid JSON with an "mcqs" array containing objects with "question", "options" (array of 4 strings), "correctAnswer" (string), and "explanation" (string, optional) properties. Ensure the correctAnswer is one of the options. Please convert this to proper JSON format:\n\n${response}\n\nReturn ONLY valid JSON.`;
      let fixedResponse: string = "[No response from fix attempt]";
      try {
        fixedResponse = await makeGroqRequest(fixPrompt, false, "You are a JSON formatting expert. Convert the provided text into the specified JSON structure for multiple-choice questions. Ensure each MCQ is complete and valid.");
        const fixedParsedContent = JSON.parse(fixedResponse);
        if (fixedParsedContent && Array.isArray(fixedParsedContent.mcqs)) {
           // Re-run validation on fixed content
          const validFixedMcqs = fixedParsedContent.mcqs.filter((mcq: any) => 
            mcq &&
            typeof mcq.question === 'string' &&
            Array.isArray(mcq.options) &&
            mcq.options.length === 4 &&
            mcq.options.every((opt: any) => typeof opt === 'string') &&
            typeof mcq.correctAnswer === 'string' &&
            mcq.options.includes(mcq.correctAnswer) &&
            (typeof mcq.explanation === 'string' || typeof mcq.explanation === 'undefined')
          );
          return {
            mcqs: validFixedMcqs,
            sourceNoteTitle: noteTitle
          };
        }
        throw new Error("Invalid MCQ structure in fixed JSON response.");
      } catch (secondError) {
        console.error("Failed to parse fixed JSON for MCQs:", secondError, fixedResponse);
        return {
          mcqs: [],
          sourceNoteTitle: noteTitle,
        };
      }
    }
  } catch (error) {
    console.error("Error generating MCQs with Groq:", error);
    return {
      mcqs: [],
      sourceNoteTitle: noteTitle,
    };
  }
}

// Helper function to make a request to the Groq API
export async function makeGroqRequest(promptContent: string, isQuestionGeneration = false, systemMessageOverride?: string): Promise<string> {
  const models = ["llama3-70b-8192", "llama-3.1-8b-instant", "mixtral-8x7b-32768"]; // Added mixtral as another option
  let lastError: Error | null = null;

  let currentSystemMessage = "";
  if (systemMessageOverride) {
    currentSystemMessage = systemMessageOverride;
  } else if (isQuestionGeneration) {
    currentSystemMessage = "You are an expert educational question generator. Your goal is to create clear, accurate, and well-structured questions that test understanding of concepts. Each question should be challenging but fair, with a clear correct answer. For multiple-choice questions, provide plausible distractors that test common misconceptions. Always include a helpful hint that guides without giving away the answer. Keep the language accessible and ensure all output is in valid JSON syntax.";
  } else {
    currentSystemMessage = "You are a helpful assistant that generates educational flashcards based on a given topic. Your goal is to create clear, accurate, and well-structured flashcards suitable for learners. Each flashcard must include a direct, focused question on the front and a concise but informative answer on the back. Always return your output as a valid JSON object containing a cards array. Each element in the array should be an object with front (the question as a string) and back (the answer as a string). Keep the language accessible, avoid overly technical jargon unless the topic requires it, and ensure all output is in valid JSON syntax. Do not include any extra commentary, explanations, or markdown outside of the JSON.";
  }

  for (const model of models) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: currentSystemMessage,
            },
            {
              role: "user",
              content: promptContent,
            },
          ],
          temperature: 0.6, // Slightly lower temperature for more predictable note structure
          max_tokens: 3000, // Increased for potentially longer notes
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // If we get a rate limit error, continue to the next model
        if (response.status === 429 || errorData.error?.message?.toLowerCase().includes("rate limit")) {
          lastError = new Error(errorData.error?.message || `Rate limit exceeded for model ${model}`);
          console.warn(`Rate limit for ${model}, trying next model...`);
          continue;
        }
        throw new Error(errorData.error?.message || `Failed to generate content with ${model}: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error(`No content returned from Groq model ${model}`);
      }

      return content;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Error with model ${model}:`, lastError.message);
      // If it's not a rate limit error, and it's the last model, we throw
      if (!lastError.message.toLowerCase().includes("rate limit") && models.indexOf(model) === models.length - 1) {
        throw lastError;
      }
      // Otherwise continue to the next model (or if it's a rate limit)
    }
  }

  // If we've tried all models and still failed, throw the last error
  throw lastError || new Error("All models failed to generate content");
}

// Helper function to process a valid JSON response
function processFlashcardResponse(parsedContent: any, topic: string): GenerationResult {
  // Extract the cards array - handle both array format and object with cards property
  let cards
  if (Array.isArray(parsedContent)) {
    cards = parsedContent
  } else if (parsedContent.cards && Array.isArray(parsedContent.cards)) {
    cards = parsedContent.cards
  } else {
    // If we can't find a cards array, create a fallback with the available data
    cards = []

    // Try to extract card data from the response in any format
    if (typeof parsedContent === "object") {
      // Look for properties that might contain card data
      for (const key in parsedContent) {
        if (
          parsedContent[key] &&
          typeof parsedContent[key] === "object" &&
          parsedContent[key].front &&
          parsedContent[key].back
        ) {
          cards.push(parsedContent[key])
        }
      }
    }

    // If still no cards, create a fallback card
    if (cards.length === 0) {
      return createFallbackCards(topic)
    }
  }

  // Validate each card has front and back properties
  const validCards = cards.filter((card: any) => card && typeof card === "object" && card.front && card.back)

  // If no valid cards were found, create a fallback
  if (validCards.length === 0) {
    return createFallbackCards(topic)
  }

  return {
    cards: validCards.map((card: any) => ({
      front: card.front,
      back: card.back,
    })),
    topic,
  }
}

// Helper function to manually extract cards from a non-JSON response
function extractCardsManually(content: string, topic: string): GenerationResult {
  const cards: GeneratedCard[] = []

  // Try to extract front/back pairs using regex patterns
  const frontBackPairs = content.match(/front["\s:]+([^"]+)["\s,]+back["\s:]+([^"]+)/gi)

  if (frontBackPairs && frontBackPairs.length > 0) {
    for (const pair of frontBackPairs) {
      const frontMatch = pair.match(/front["\s:]+([^"]+)/i)
      const backMatch = pair.match(/back["\s:]+([^"]+)/i)

      if (frontMatch && frontMatch[1] && backMatch && backMatch[1]) {
        cards.push({
          front: frontMatch[1].trim(),
          back: backMatch[1].trim(),
        })
      }
    }
  }

  // If we couldn't extract cards using regex, try to find question-answer patterns
  if (cards.length === 0) {
    const lines = content.split("\n").filter((line) => line.trim().length > 0)

    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim()
      const nextLine = lines[i + 1].trim()

      // Look for patterns like "Q: ... A: ..." or numbered questions
      if (
        (line.startsWith("Q:") || line.match(/^\d+[.)]/)) &&
        (nextLine.startsWith("A:") || nextLine.match(/^Answer:/i))
      ) {
        cards.push({
          front: line.replace(/^Q:|\d+[.)]/, "").trim(),
          back: nextLine.replace(/^A:|Answer:/i, "").trim(),
        })
        i++ // Skip the answer line since we've already processed it
      }
    }
  }

  // If we still couldn't extract cards, create fallback cards
  if (cards.length === 0) {
    return createFallbackCards(topic)
  }

  return {
    cards,
    topic,
  }
}

// Helper function to create fallback cards when all else fails
function createFallbackCards(topic: string): GenerationResult {
  return {
    cards: [
      {
        front: `What is ${topic}?`,
        back: "This card was generated as a fallback. Please try generating flashcards again.",
      },
      {
        front: `Describe the key concepts of ${topic}.`,
        back: "This card was generated as a fallback. Please try generating flashcards again.",
      },
    ],
    topic,
  }
}
