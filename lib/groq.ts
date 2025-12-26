import { generateImage } from "./image-generation";

// Feature flag cache for provider default (Statsig)
let __groqDefaultFlag: boolean | null = null;
async function shouldDefaultToGroq(): Promise<boolean> {
    if (__groqDefaultFlag !== null) return __groqDefaultFlag;
    try {
        // 1) Env override wins
        const envOverride = (process.env.NEXT_PUBLIC_USE_GROQ_DEFAULT || '').toLowerCase();
        if (envOverride === 'true' || envOverride === '1') {
            __groqDefaultFlag = true;
            console.log('[AI Provider] Env override NEXT_PUBLIC_USE_GROQ_DEFAULT=true -> groqFirst=true');
            return true;
        }
        if (envOverride === 'false' || envOverride === '0') {
            __groqDefaultFlag = false;
            console.log('[AI Provider] Env override NEXT_PUBLIC_USE_GROQ_DEFAULT=false -> groqFirst=false');
            return false;
        }

        if (typeof window === 'undefined') {
            __groqDefaultFlag = false;
            try { console.log('[AI Provider] SSR detected; defaulting groqFirst=false'); } catch { }
            return false;
        }
        const key = process.env.NEXT_PUBLIC_STATSIG_CLIENT_KEY;
        if (!key) {
            __groqDefaultFlag = false;
            try { console.log('[AI Provider] NEXT_PUBLIC_STATSIG_CLIENT_KEY not set; groqFirst=false (no gate)'); } catch { }
            return false;
        }
        // 2) Statsig gate (client-side only)
        // @ts-ignore - optional dependency, types may be missing
        const mod: any = await import('statsig-js').catch(() => null);
        const Statsig = mod?.Statsig;
        if (!Statsig) { __groqDefaultFlag = false; return false; }
        try {
            await Statsig.initialize(key, { userID: 'anonymous' });
        } catch {
            __groqDefaultFlag = false;
            return false;
        }
        const enabled = !!Statsig.checkGate('use_groq_default');
        try { console.log(`[AI Provider] Statsig gate use_groq_default=${enabled}`); } catch { }
        __groqDefaultFlag = enabled;
        return enabled;
    } catch {
        __groqDefaultFlag = false;
        try { console.log('[AI Provider] Statsig evaluation failed; groqFirst=false'); } catch { }
        return false;
    }
}

export interface GeneratedCard {
    question: string;
    answer: string;
    image?: string | null;
}

export interface GenerationResult {
    cards: GeneratedCard[];
    topic: string;
    difficulty: string;
    created: string;
}

export interface HintResult {
    hint: string;
    level: number;
}

export interface GradingResult {
    isCorrect: boolean;
    score: number;
    feedback: string;
    explanation?: string;
    suggestions?: string;
    relatedConcepts?: string[];
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

export interface GeneratedQuestion {
    question: string;
    answer: string;
    hint: string;
    options?: string[];
}

export async function generateFlashcards(
    topic: string,
    numCards: number = 5,
    difficulty: string = "medium",
    includeImages: boolean = false
): Promise<GenerationResult> {
    try {
        const systemMessage = `You are an expert educational content creator specializing in creating high-quality flashcards. Your task is to create ${numCards} flashcards about "${topic}" at ${difficulty} difficulty level.

Guidelines for creating effective flashcards:
1. Questions should be clear, specific, and test understanding
2. Answers should be concise but complete
3. Use simple, direct language
4. Focus on key concepts and important details
5. Avoid overly complex or ambiguous questions
6. if it's about a language, include just a word or sentence on one side and the translation on the other

IMPORTANT: Format each flashcard EXACTLY like this:
Q: [Your question here]
A: [Your answer here]

Do not use any other format or prefixes. Each flashcard must start with "Q:" and its answer must start with "A:".`;

        const userPrompt = `Generate ${numCards} flashcards about "${topic}" at ${difficulty} difficulty level. Make sure each flashcard follows the exact format specified.`;

        // Use the updated makeGroqRequest function which will try Pollinations AI first, then fallback to Groq
        const content = await makeGroqRequest(userPrompt, false, systemMessage);
        console.log("Raw flashcard response:", content);

        // Parse the content to extract flashcards
        const flashcards: GeneratedCard[] = [];
        const lines = content.split("\n");
        let currentCard: Partial<GeneratedCard> = {};

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue; // Skip empty lines

            if (trimmedLine.startsWith("Q:") || trimmedLine.startsWith("Question:")) {
                // If we have a complete previous card, add it
                if (currentCard.question && currentCard.answer) {
                    console.log("Adding card:", currentCard);
                    flashcards.push(currentCard as GeneratedCard);
                }
                // Start a new card
                currentCard = {
                    question: trimmedLine.replace(/^(Q:|Question:)\s*/, "").trim(),
                    answer: "",
                    image: null,
                };
            } else if (trimmedLine.startsWith("A:") || trimmedLine.startsWith("Answer:")) {
                if (currentCard.question) {
                    currentCard.answer = trimmedLine.replace(/^(A:|Answer:)\s*/, "").trim();
                }
            }
        }

        // Add the last card if it's complete
        if (currentCard.question && currentCard.answer) {
            console.log("Adding final card:", currentCard);
            flashcards.push(currentCard as GeneratedCard);
        }

        console.log("Total cards parsed:", flashcards.length);
        console.log("Cards:", flashcards);

        // Only generate images if explicitly requested and we have valid cards
        if (includeImages && flashcards.length > 0) {
            const imagePromises = flashcards.map(async (card) => {
                try {
                    const imageResult = await generateImage(card.question);
                    if (imageResult.data && imageResult.data[0]) {
                        card.image = `data:image/jpeg;base64,${imageResult.data[0].b64_json}`;
                    }
                } catch (error) {
                    console.error("Error generating image for card:", error);
                }
                return card;
            });

            await Promise.all(imagePromises);
        }

        // Validate that we have cards before returning
        if (flashcards.length === 0) {
            throw new Error("No valid flashcards were generated. Please try again.");
        }

        return {
            cards: flashcards,
            topic,
            difficulty,
            created: new Date().toISOString(),
        };
    } catch (error) {
        console.error("Error in generateFlashcards:", error);
        throw error;
    }
}

export async function generateHint(
    question: string,
    correctAnswer: string,
    questionType: string,
    hintLevel: number,
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
  
  Return the response as a JSON object with a "hint" string property.`;

    try {
        const response = await makeGroqRequest(prompt, true);
        const parsedContent = JSON.parse(response);
        return {
            hint:
                parsedContent.hint ||
                "Think carefully about the question and consider all aspects of the content.",
            level: hintLevel,
        };
    } catch (error) {
        console.error("Error generating hint:", error);
        return {
            hint: "Think carefully about the question and consider all aspects of the content.",
            level: hintLevel,
        };
    }
}

export async function gradeAnswerWithGroq(
    questionType: string,
    question: string,
    correctAnswer: string,
    userAnswer: string,
    options?: {
        adaptiveScoring?: boolean;
        timePressure?: "low" | "medium" | "high";
        previousAnswers?: GradingResult[];
    },
): Promise<GradingResult> {
    const prompt = `Grade the following exam answer. You are an expert teacher evaluating a student's response.

  Question Type: ${questionType}
  Question: ${question}
  
  EXPECTED CORRECT ANSWER (from question generation): ${correctAnswer}
  STUDENT'S ANSWER: ${userAnswer}
  
  ${options?.adaptiveScoring ? "Adaptive Scoring: Enabled" : ""}
  ${options?.timePressure ? `Time Pressure: ${options.timePressure}` : ""}
  ${options?.previousAnswers ? `Previous Performance: ${JSON.stringify(options.previousAnswers)}` : ""}
  
  Evaluation Guidelines:
  1. Compare the student's answer against the EXPECTED CORRECT ANSWER
  2. Consider partial credit for answers that demonstrate understanding but may be incomplete
  3. For short-answer questions, look for key concepts and ideas rather than exact word matching
  4. Provide constructive feedback that helps the student learn
  5. Consider the question type when evaluating (multiple choice vs short answer vs true/false)
  
  Return the response as a JSON object with the following properties:
  {
    "isCorrect": boolean,
    "score": number (0-100),
    "feedback": string,
    "explanation": string (optional),
    "suggestions": string (optional),
    "relatedConcepts": string[] (optional)
  }`;

    try {
        const response = await makeGroqRequest(prompt, true);
        let parsedContent: any;
        try {
            parsedContent = JSON.parse(response);
        } catch (jsonErr) {
            // Try to extract JSON substring
            const match = response.match(/\{[\s\S]*\}/);
            if (match) {
                try {
                    parsedContent = JSON.parse(match[0]);
                } catch (extractErr) {
                    // Parsing failed again, fallback below
                    parsedContent = null;
                }
            } else {
                parsedContent = null;
            }
        }

        // Validate the response format
        if (
            !parsedContent ||
            typeof parsedContent.isCorrect !== "boolean" ||
            typeof parsedContent.score !== "number" ||
            typeof parsedContent.feedback !== "string"
        ) {
            throw new Error("Invalid response format from Groq");
        }

        // Ensure score is between 0 and 100
        parsedContent.score = Math.max(0, Math.min(100, parsedContent.score));

        return {
            isCorrect: parsedContent.isCorrect,
            score: parsedContent.score,
            feedback: parsedContent.feedback,
            explanation: parsedContent.explanation,
            suggestions: parsedContent.suggestions,
            relatedConcepts: parsedContent.relatedConcepts,
        };
    } catch (error) {
        console.error("Error grading answer with Groq:", error);
        // Fallback to basic grading if Groq fails
        return {
            isCorrect:
                userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim(),
            score:
                userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim()
                    ? 100
                    : 0,
            feedback: "An error occurred while grading. Please try again.",
            explanation: "The grading service is temporarily unavailable.",
            suggestions: "Try submitting your answer again.",
        };
    }
}

// Essay grading result interface
export interface EssayGradingResult {
    marksAwarded: number;
    maxMarks: number;
    percentage: number;
    feedback: string;
    strengths: string[];
    improvements: string[];
    levelDescriptor?: string;
}

// Subject-specific marking prompts for GCSE essays
const SUBJECT_MARKING_PROMPTS: Record<string, string> = {
    english_language: `You are a GCSE English Language examiner.
Place this response into the most appropriate level, then award a mark within that level.

Assess:
- AO5: Effectiveness of communication, tone, and register for purpose/audience
- AO6: Spelling, punctuation, grammar, and sentence control
- Sentence variety and control of syntax
- Vocabulary range, precision, and ambition
- Coherence, paragraphing, and overall structure

Reference OCR mark scheme descriptors. Justify the level chosen and explain why the mark is not higher.`,

    english_literature: `You are a GCSE English Literature examiner.
Determine the level first, then award a mark within that level.

Assess:
- AO1: Knowledge and understanding of the text; use of quotations
- AO2: Analysis of language, form, and structure
- AO3: Relevant context integrated into the argument
- Conceptual, critical, and exploratory response
- Quality of written expression and argument development

Use OCR mark scheme bands. Explain strengths, limitations, and how the response could move up a level.`,

    geography: `You are a GCSE Geography examiner.
Identify the level, then award a mark within it.

Assess:
- Accurate and confident use of geographical terminology
- Application of knowledge to case studies and real examples
- Understanding of physical and/or human processes
- Use and interpretation of data, maps, or figures where relevant
- Evaluation, judgement, and balance (for higher-level responses)

Apply OCR mark scheme descriptors and comment on depth vs breadth of knowledge.`,

    history: `You are a GCSE History examiner.
Place the answer into the correct level before deciding the final mark.

Assess:
- AO1: Accurate, relevant historical knowledge
- AO2: Explanation of causation, consequence, change, or similarity/difference
- AO3 (if applicable): Source analysis and interpretation
- Use of second-order concepts (significance, interpretations)
- Sustained judgement and quality of argument

Use AQA/Edexcel level descriptors. Explain what limits the response from reaching the top of the level.`,

    product_design: `You are a GCSE Design & Technology examiner.
Decide the level, then fine-tune the mark.

Assess:
- Correct and precise use of technical vocabulary
- Knowledge of materials, components, and manufacturing processes
- Understanding of sustainability, tolerances, and production methods
- Application of design principles and theory to the context
- Quality of explanation, justification, and decision-making

Apply AQA mark scheme levels and give clear improvement targets.`,

    religious_studies: `You are a GCSE Religious Studies examiner.
Award a level first, then a mark within that level.

Assess:
- Knowledge and understanding of beliefs, teachings, and practices
- Use of religious language and sources of authority
- Consideration of different religious and non-religious viewpoints
- Evaluation, reasoning, and justified conclusions
- Balance and coherence of the argument

Use AQA/Edexcel descriptors and comment on evaluative depth.`,

    science: `You are a GCSE Science examiner.
Determine the level of response, then award marks accordingly.

Assess:
- Accuracy and precision of scientific terminology
- Understanding of key concepts and processes
- Application of knowledge to unfamiliar contexts
- Clarity and logical sequencing of explanations
- Correct use of equations, data, units, and calculations (if relevant)

Apply AQA level-based mark schemes and identify any misconceptions.`,

    "ocr-gcse-economics": `You are an OCR GCSE Economics examiner.

Step 1: Identify the appropriate level using OCR level descriptors.
Step 2: Award a specific mark within that level.

This is a level-of-response question. Do NOT count points.

Assess the response against:
- AO1: Accurate knowledge and understanding of relevant economic concepts and terminology
- AO2: Clear application to the specific context given in the question
- AO3: Analysis shown through clear, logical chains of reasoning (cause → effect → outcome)

For evaluation questions only:
- Judgement supported by analysis (e.g. weighing factors, conditions, short vs long run)

Quantitative skills are NOT required unless explicitly demanded by the question; reward them only if used accurately and meaningfully.

Ignore minor spelling and grammar errors unless they impede meaning.

Explain:
- Why the response fits the awarded level
- What specific improvements are needed to reach the next level`,

    default: `You are a GCSE examiner.
Assign a level (if applicable), then award a mark.

Assess:
- Accuracy and relevance to the question
- Use of subject-specific terminology
- Clarity and depth of explanation or reasoning
- Structure, organisation, and coherence

Justify the mark awarded and state one clear improvement action.`
};

export async function gradeEssayWithGroq(
    subject: string,
    question: string,
    answer: string,
    maxMarks: number,
    context?: string
): Promise<EssayGradingResult> {
    const subjectKey = subject.toLowerCase().replace(/\s+/g, '_');
    const markingPrompt = SUBJECT_MARKING_PROMPTS[subjectKey] || SUBJECT_MARKING_PROMPTS.default;

    const contextSection = context && context.trim()
        ? `\n\nADDITIONAL CONTEXT/MARK SCHEME:\n${context.trim()}\n\nUse the above context to inform your marking. If it contains a mark scheme, follow it closely.`
        : '';

    const prompt = `${markingPrompt}${contextSection}

QUESTION (${maxMarks} marks): ${question}

STUDENT'S ANSWER:
${answer}

Grade this answer out of ${maxMarks} marks. Be fair but rigorous in your assessment.

Return the response as a JSON object with these properties:
{
    "marksAwarded": number (0 to ${maxMarks}),
    "percentage": number (0-100),
    "feedback": string (2-3 sentences of overall feedback),
    "strengths": string[] (2-3 specific strengths),
    "improvements": string[] (2-3 areas for improvement),
    "levelDescriptor": string (e.g., "Level 3 - Good understanding shown")
}`;

    try {
        const response = await makeGroqRequest(prompt, true, "You are an expert GCSE examiner providing fair, constructive feedback.");

        let parsedContent: any;
        try {
            parsedContent = JSON.parse(response);
        } catch (jsonErr) {
            const match = response.match(/\{[\s\S]*\}/);
            if (match) {
                try {
                    parsedContent = JSON.parse(match[0]);
                } catch {
                    parsedContent = null;
                }
            }
        }

        if (!parsedContent || typeof parsedContent.marksAwarded !== "number") {
            throw new Error("Invalid response format from Groq");
        }

        // Ensure marks are within valid range
        const marksAwarded = Math.max(0, Math.min(maxMarks, Math.round(parsedContent.marksAwarded)));
        const percentage = Math.round((marksAwarded / maxMarks) * 100);

        return {
            marksAwarded,
            maxMarks,
            percentage,
            feedback: parsedContent.feedback || "Your answer has been graded.",
            strengths: Array.isArray(parsedContent.strengths) ? parsedContent.strengths : [],
            improvements: Array.isArray(parsedContent.improvements) ? parsedContent.improvements : [],
            levelDescriptor: parsedContent.levelDescriptor,
        };
    } catch (error) {
        console.error("Error grading essay with Groq:", error);
        return {
            marksAwarded: 0,
            maxMarks,
            percentage: 0,
            feedback: "An error occurred while grading. Please try again.",
            strengths: [],
            improvements: ["Unable to grade - please resubmit your answer."],
        };
    }
}

function unescapeGeneratedContent(content: string): string {
    return content
        .replace(/\\n/g, '\n')  // Replace \n with actual newlines
        .replace(/\\"/g, '"')   // Replace \" with "
        .replace(/\\\\/g, '\\') // Replace \\ with \
        .replace(/\\t/g, '\t')  // Replace \t with tabs
        .replace(/\\r/g, '\r'); // Replace \r with carriage returns
}

export async function generateNoteWithGroq(
    topic: string,
): Promise<GeneratedNote> {
    const prompt = `Generate a comprehensive, well-structured, and visually rich note on the topic: "${topic}".
  
    The note should include:
    - A concise and informative title that clearly reflects the topic.
    - Well-organized markdown content with logical flow and appropriate use of formatting elements to enhance readability and engagement.
  
    Markdown Formatting Guidelines (Use all where applicable):
  
    Titles and Headings
    - Use # for main title (h1)
    - Use ## for major sections (h2)
    - Use ###, ####, ##### for nested subsections as needed
  
    Info Boxes
    - Use colored info blocks to highlight important points or summaries:
      Syntax:
      ::color
      content
      ::
    - Available colors: rose, amber, blue, green
  
    Lists
    - Bullet points with * or -
    - Numbered lists with 1., 2., etc.
  
    Text Formatting
    - Bold for emphasis (double asterisks)
    - Italic for nuance (single asterisks)
    - Strikethrough for removed/incorrect content (double tildes)
    - Highlight important terms with double equals
    - Use inline code backticks for technical references or commands
  
    LaTeX Math (Use only when needed)
    - Inline math: $ E = mc^2 $
    - Block math:
    $$
    \\frac{d}{dx}(x^n) = nx^{n-1}
    $$
    - For inline text: $ \\text{Example} $
    - Supported symbols include Greek letters (e.g. $ \\alpha $, $ \\pi $), operators (e.g. $ \\sum $, $ \\int $), fractions, exponents, subscripts, and matrices
  
    Block Elements
    - Use > for blockquotes (citations or emphasis)
    - Use --- for horizontal rules to separate sections
    - Use triple backticks for code blocks:
    \`\`\`
    Your code here
    \`\`\`
    - Use double colons for centered text: ::centered text::
  
    Links
    - Use [Link text](URL) syntax for citations, sources, or related reading
    Images
    - use !(img)[image name]
    - the backend searches for the image name so write no more than what you want the image to be
    - e.g !(img)[cat]
    Multple choices questions
    - ?? Your question here
    - [x] Correct answer
    - [ ] Incorrect answer
    - [ ] Another incorrect answer
    Fill the blanks
    - embed in the content like this: This is a [gap:fill the gap question]
    Matching questions
    ::dragdrop
    Question: Match the capitals to their countries.
    - France => [drop:Paris]
    - Germany => [drop:Berlin]
    - Italy => [drop:Rome]
    Options: Paris, Berlin, Rome
    ::
    - use ::dragdrop:: to start the matching question
    - use [drop:answer] to mark the answer
    - use Options: to mark the options
    - use Question: to mark the question
    - use :: to mark the end of the matching question

    Output Requirements:
    - Ensure content is detailed, accurate, and structured clearly.
    - Break down complex ideas into digestible parts.
    - Use formatting tools judiciously—avoid LaTeX, code blocks, or centering unless relevant.
  IMPORTANT: Format the response as a valid JSON object with "title" (string) and "content" (string, Markdown formatted) properties. The response must be valid JSON that can be parsed by JSON.parse().
  
  Example output:
  {
    "title": "Key Concepts of Photosynthesis",
    "content": "# Photosynthesis: The Foundation of Life\\n\\n## Introduction\\nPhotosynthesis is a vital process...\\n\\n### Reactants\\n- Water (H2O)\\n- Carbon Dioxide (CO2)\\n\\n### Products\\n- Glucose (C6H12O6)\\n- Oxygen (O2)\\n\\n> This process is fundamental to life on Earth, providing both oxygen and energy.\\n\\n## Chemical Equation\\n$ 6CO_2 + 6H_2O + \\text{light} \\rightarrow C_6H_{12}O_6 + 6O_2 $\\n\\n---\\n\\n## Key Stages\\n1. Light-dependent reactions\\n2. Calvin cycle (light-independent reactions)\\n\\n### Light-Dependent Reactions\\n==These reactions convert light energy to chemical energy==\\n\\nThe energy conversion can be expressed as:\\n$$\\nE = h\\nu = \\frac{hc}{\\lambda}\\n$$\\n\\nWhere:\\n- $ E $ is the energy of a photon\\n- $ h $ is Planck's constant\\n- $ \\nu $ is the frequency\\n- $ \\lambda $ is the wavelength\\n\\n::The miracle of converting sunlight to chemical energy::"
  }`;

    const systemMessage =
        "You are an expert content creator specializing in generating well-structured notes in Markdown format. Your output must always be a valid JSON object with 'title' and 'content' (Markdown) properties. The response must be valid JSON that can be parsed by JSON.parse(). When using LaTeX math, ensure proper spacing and line breaks to prevent parsing errors. Ensure the Markdown is clean and follows standard conventions.";

    try {
        // First attempt to generate the note with forced JSON format
        const response = await makeGroqRequest(prompt, false, systemMessage, true);

        let parsedContent;
        try {
            parsedContent = JSON.parse(response);
            if (
                parsedContent &&
                typeof parsedContent.title === "string" &&
                typeof parsedContent.content === "string"
            ) {
                // Clean up any potential LaTeX math formatting issues and unescape content
                const cleanedContent = unescapeGeneratedContent(parsedContent.content)
                    .replace(/\$\s*#/g, "$ ") // Remove any # characters that might appear after $
                    .replace(/#\s*\$/g, " $") // Remove any # characters that might appear before $
                    .replace(/\$\$\s*#/g, "$$ ") // Remove any # characters that might appear after $$
                    .replace(/#\s*\$\$/g, " $$"); // Remove any # characters that might appear before $$

                return {
                    title: parsedContent.title,
                    content: cleanedContent,
                };
            }
            throw new Error("Invalid note structure in JSON response");
        } catch (error) {
            console.log(
                "Failed to parse JSON for note, attempting to fix format:",
                response,
            );

            // Try to extract title and content from the response
            const titleMatch = response.match(/"title"\s*:\s*"([^"]+)"/);
            const contentMatch = response.match(/"content"\s*:\s*"([^"]+)"/);

            if (titleMatch && contentMatch) {
                try {
                    // Create a properly formatted JSON object and clean up LaTeX math
                    const content = unescapeGeneratedContent(contentMatch[1])
                        .replace(/\$\s*#/g, "$ ")
                        .replace(/#\s*\$/g, " $")
                        .replace(/\$\$\s*#/g, "$$ ")
                        .replace(/#\s*\$\$/g, " $$");

                    return {
                        title: titleMatch[1],
                        content: content,
                    };
                } catch (extractError) {
                    console.error("Failed to extract title and content:", extractError);
                }
            }

            // If extraction failed, try one more time with a more specific fix prompt
            const fixPrompt = `The following response needs to be formatted as valid JSON with "title" and "content" (Markdown) properties. Please convert this to proper JSON format, ensuring all special characters are properly escaped and LaTeX math expressions are properly formatted with spaces:\n\n${response}\n\nReturn ONLY valid JSON in this format:\n{\n  "title": "Note Title",\n  "content": "Markdown content..."\n}`;

            try {
                const fixedResponse = await makeGroqRequest(
                    fixPrompt,
                    false,
                    "You are a JSON formatting expert. Convert the provided text into the specified JSON structure with 'title' and 'content' fields. Ensure all special characters are properly escaped and LaTeX math expressions are properly formatted with spaces.",
                    true,
                );
                const fixedParsedContent = JSON.parse(fixedResponse);
                if (
                    fixedParsedContent &&
                    typeof fixedParsedContent.title === "string" &&
                    typeof fixedParsedContent.content === "string"
                ) {
                    // Clean up any potential LaTeX math formatting issues
                    const cleanedContent = unescapeGeneratedContent(fixedParsedContent.content)
                        .replace(/\$\s*#/g, "$ ")
                        .replace(/#\s*\$/g, " $")
                        .replace(/\$\$\s*#/g, "$$ ")
                        .replace(/#\s*\$\$/g, " $$");

                    return {
                        title: fixedParsedContent.title,
                        content: cleanedContent,
                    };
                }
                throw new Error("Invalid note structure in fixed JSON response");
            } catch (secondError) {
                console.error("Failed to parse fixed JSON for note:", secondError);
                // If all attempts fail, create a fallback note
                return {
                    title: `Note on ${topic} (Generation Failed)`,
                    content: `Failed to generate content for "${topic}" after multiple attempts. Please try again or check the logs.`,
                };
            }
        }
    } catch (error) {
        console.error("Error generating note with Groq:", error);
        return {
            title: `Note on ${topic} (Error)`,
            content: `An error occurred while trying to generate a note for "${topic}". Please check the console for more details.`,
        };
    }
}

export async function generateMultipleChoiceQuestionsWithGroq(
    noteContent: string,
    noteTitle?: string,
    numberOfQuestions = 3,
): Promise<MCQGenerationResult> {
    const prompt = `Based on the following note content, generate ${numberOfQuestions} multiple-choice questions (MCQs). Each question should test understanding of key concepts from the note.
  
  Note Title (for context, if available): "${noteTitle || "Untitled Note"}"
  
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

    const systemMessage =
        "You are an expert in creating educational multiple-choice questions based on provided text. Your output must always be a valid JSON object with an 'mcqs' array, where each MCQ has 'question', 'options', 'correctAnswer', and optionally 'explanation' fields. Ensure the options are plausible and the correct answer is clearly identifiable from the note content.";

    try {
        const response = await makeGroqRequest(prompt, false, systemMessage);
        let parsedContent;
        try {
            parsedContent = JSON.parse(response);
        } catch (jsonErr) {
            // Try to extract JSON substring
            const match = response.match(/\{[\s\S]*\}/);
            if (match) {
                try {
                    parsedContent = JSON.parse(match[0]);
                } catch (extractErr) {
                    parsedContent = null;
                }
            } else {
                parsedContent = null;
            }
        }
        if (parsedContent && Array.isArray(parsedContent.mcqs)) {
            // Basic validation for each MCQ structure
            const validMcqs = parsedContent.mcqs.filter(
                (mcq: any) =>
                    mcq &&
                    typeof mcq.question === "string" &&
                    Array.isArray(mcq.options) &&
                    mcq.options.length === 4 &&
                    mcq.options.every((opt: any) => typeof opt === "string") &&
                    typeof mcq.correctAnswer === "string" &&
                    mcq.options.includes(mcq.correctAnswer) &&
                    (typeof mcq.explanation === "string" ||
                        typeof mcq.explanation === "undefined"),
            );

            if (validMcqs.length === 0 && parsedContent.mcqs.length > 0) {
                // Some MCQs were generated but didn't pass validation
                console.warn("Some MCQs failed validation:", parsedContent.mcqs);
                // Potentially try to fix them or return a partial result if needed in future
            }

            return {
                mcqs: validMcqs,
                sourceNoteTitle: noteTitle,
            };
        }
        throw new Error(
            "Invalid MCQ structure in JSON response or no MCQs generated.",
        );
    } catch (error) {
        console.log(
            "Failed to parse JSON for MCQs, attempting to fix format:",
            error,
        );
        const fixPrompt = `The following response needs to be formatted as valid JSON with an "mcqs" array containing objects with "question", "options" (array of 4 strings), "correctAnswer" (string), and "explanation" (string, optional) properties. Ensure the correctAnswer is one of the options. Please convert this to proper JSON format:\n\n${error}\n\nReturn ONLY valid JSON.`;
        let fixedResponse: string = "[No response from fix attempt]";
        try {
            fixedResponse = await makeGroqRequest(
                fixPrompt,
                false,
                "You are a JSON formatting expert. Convert the provided text into the specified JSON structure for multiple-choice questions. Ensure each MCQ is complete and valid.",
            );
            let fixedParsedContent;
            try {
                fixedParsedContent = JSON.parse(fixedResponse);
            } catch (jsonErr) {
                // Try to extract JSON substring
                const match = fixedResponse.match(/\{[\s\S]*\}/);
                if (match) {
                    try {
                        fixedParsedContent = JSON.parse(match[0]);
                    } catch (extractErr) {
                        fixedParsedContent = null;
                    }
                } else {
                    fixedParsedContent = null;
                }
            }
            if (fixedParsedContent && Array.isArray(fixedParsedContent.mcqs)) {
                // Re-run validation on fixed content
                const validFixedMcqs = fixedParsedContent.mcqs.filter(
                    (mcq: any) =>
                        mcq &&
                        typeof mcq.question === "string" &&
                        Array.isArray(mcq.options) &&
                        mcq.options.length === 4 &&
                        mcq.options.every((opt: any) => typeof opt === "string") &&
                        typeof mcq.correctAnswer === "string" &&
                        mcq.options.includes(mcq.correctAnswer) &&
                        (typeof mcq.explanation === "string" ||
                            typeof mcq.explanation === "undefined"),
                );
                return {
                    mcqs: validFixedMcqs,
                    sourceNoteTitle: noteTitle,
                };
            }
            throw new Error("Invalid MCQ structure in fixed JSON response.");
        } catch (secondError) {
            console.error(
                "Failed to parse fixed JSON for MCQs:",
                secondError,
                fixedResponse,
            );
            return {
                mcqs: [],
                sourceNoteTitle: noteTitle,
            };
        }
    }
}

// Helper function to make a request to the Pollinations AI API or Groq API
export async function makeGroqRequest(
    prompt: string,
    requireJson: boolean = false,
    systemMessage: string = "You are a helpful assistant.",
    forceJson: boolean = false
): Promise<string> {
    try {
        // Local helper to call Groq directly
        const tryGroq = async (): Promise<string> => {
            const groqApiKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;
            console.log("Debug: Using Groq API Key starting with:", groqApiKey ? groqApiKey.substring(0, 4) + "..." : "undefined");
            if (!groqApiKey) {
                throw new Error("GROQ_API_KEY (or NEXT_PUBLIC_GROQ_API_KEY) is not defined in environment variables");
            }
            const groqRequestBody = {
                messages: [
                    { role: "system", content: systemMessage },
                    { role: "user", content: prompt },
                ],
                model: "openai/gpt-oss-120b",
                temperature: 0.6,
                max_tokens: 10000,
            };
            console.log("Groq request body:", JSON.stringify(groqRequestBody, null, 2));
            const groqResponse = await fetch(
                "https://api.groq.com/openai/v1/chat/completions",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${groqApiKey}`,
                    },
                    body: JSON.stringify(groqRequestBody),
                },
            );

            if (!groqResponse.ok) {
                const errorData = await groqResponse.json().catch(() => null);
                console.error("Groq API error response:", {
                    status: groqResponse.status,
                    statusText: groqResponse.statusText,
                    errorData,
                });
                throw new Error(
                    `Groq API error: ${groqResponse.statusText}${errorData ? ` - ${JSON.stringify(errorData)}` : ""
                    }`
                );
            }
            const data = await groqResponse.json();
            return data.choices[0].message.content;
        };

        // Decide ordering via Statsig gate
        const groqFirst = await shouldDefaultToGroq();

        // Try preferred provider first, then fallback to the other
        if (groqFirst) {
            try {
                return await tryGroq();
            } catch (firstErr) {
                console.warn("Groq failed, attempting Pollinations fallback:", firstErr);
                // Continue to Pollinations path below
            }
        }

        // Try Pollinations AI first (unless Groq already attempted and failed)
        try {
            console.log("Attempting to use Pollinations AI OpenAI-compatible endpoint");

            // Prepare the request body for the POST endpoint
            const requestBody: any = {
                model: "openai",
                messages: [
                    {
                        role: "system",
                        content: systemMessage,
                    },
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
                stream: false,
                private: true,
            };

            // Add JSON mode if required
            if (requireJson || forceJson) {
                requestBody.response_format = { type: "json_object" };
            }

            console.log("Pollinations AI request body:", JSON.stringify(requestBody, null, 2));

            // Add a timeout so we don't hang and fail to fallback
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            let response: Response;
            try {
                response = await fetch("https://text.pollinations.ai/openai", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal,
                });
            } finally {
                clearTimeout(timeoutId);
            }

            // Treat any non-2xx, including 429, as a controlled failure to trigger fallback
            if (!response.ok) {
                const errorText = await response.text().catch(() => "Unknown error");
                console.error("Pollinations AI error response:", {
                    status: response.status,
                    statusText: response.statusText,
                    errorText,
                });
                throw new Error(
                    `Pollinations AI error: ${response.statusText} - ${errorText}`
                );
            }

            let data: any = null;
            try {
                data = await response.json();
            } catch (e: any) {
                // If JSON parsing fails, force fallback
                throw new Error("Pollinations AI returned invalid JSON");
            }
            console.log("Pollinations AI response:", data);

            // If the payload includes an explicit error, or has no usable message, force fallback
            const hasChoices = !!(data && data.choices && data.choices[0] && data.choices[0].message && typeof data.choices[0].message.content === 'string');
            const textLike = typeof data?.text === 'string' ? data.text : (typeof data?.content === 'string' ? data.content : null);
            if (data?.error || (!hasChoices && !textLike)) {
                throw new Error(`Pollinations AI unusable payload${data?.error ? ': ' + JSON.stringify(data.error) : ''}`);
            }
            const content = hasChoices ? data.choices[0].message.content : (textLike as string);
            return content;
        } catch (pollinationsError) {
            console.error("Pollinations AI failed, falling back to Groq:", pollinationsError);
            // Fallback to Groq (or, if Groq was tried first and failed too, rethrow)
            return await tryGroq();
        }
    } catch (err) {
        console.error("Full error details:", err);
        if (err instanceof TypeError && err.message === "Failed to fetch") {
            throw new Error(
                "Network error: Could not connect to the API endpoints. Please check your internet connection and try again."
            );
        }
        throw err;
    }
}

/**
 * Generate an exam (as Markdown) from an existing note. The output is pure Markdown
 * using the app's supported interactive directives so it can be rendered by MarkdownContent:
 * - Multiple choice: :::mcq{question="..."} with a task list where [x] marks correct options
 * - Matching: :::matching{title="..."} with list items formatted as "Term :: Definition"
 * - Fill-the-gap: inline gaps using (gap:answer)
 */
export async function generateExamMarkdownFromNote(
    noteContent: string,
    noteTitle?: string,
    numberOfQuestions: number = 8,
): Promise<string> {
    const systemMessage = "You are an expert exam composer. Output ONLY Markdown that our renderer understands. No JSON, no explanations. Write on a gcse exam level";
    const prompt = `Create a concise study test from the following note. Use ONLY these formats so the UI can render interactives:

Sections and formats to include:
1) A small set of MCQs (mix single- and multi-correct). For each MCQ use:
:::mcq{question="Your clear question"}
- [ ] Option A
- [x] Option B
- [ ] Option C
:::

2) A short matching exercise:
:::matching{title="Match terms" shuffle="true"}
- Term 1 :: Definition 1
- Term 2 :: Definition 2
:::

3) A few fill-the-gap prompts embedded in short sentences using the inline syntax (gap:answer), for example:
Photosynthesis occurs in the (gap:chloroplasts).

4) Two or three longer written questions in the style of GCSE papers that assess analysis/explanation. For each written question, use a LEAF directive (single colon) on a single line so the app can grade with AI without revealing the answer (no closing block required) place each new question on a new line:
e.g

:written{question="Write a developed response explaining ...", expected="A model answer or key points here"}

:written{question="question 2 ...", expected="add the expected answer here"}
Keep the total to about ${numberOfQuestions} questions/prompts across sections. All content must be derived ONLY from the note. Do not invent unrelated facts.

Strict rules:
- Do NOT use HTML tags like <written .../>. Always use the :written{...} leaf directive.
- Do NOT wrap the output in triple backticks.
- Make sure to generate enough questions to cover all topics of the note - its fine to go over the recommended number of questions
Note Title: ${noteTitle || 'Untitled'}
Note Content:
"""
${noteContent}
"""

Output: ONLY Markdown with the directives above. No extra prose before or after.`;

    let md = await makeGroqRequest(prompt, false, systemMessage, false);
    console.log("Groq response:", md);
    const out = typeof md === 'string' ? md : String(md);
    // Post-process: strip surrounding code fences and normalize any accidental HTML tags into directives
    const stripped = out.replace(/^```[a-zA-Z0-9]*\n([\s\S]*?)\n```\s*$/m, '$1');
    // Unescape common sequences (\n, \", \\) so directives parse attributes correctly
    const unescaped = stripped
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    // Normalize any accidental HTML self-closing tags and container directives to a single-line leaf :written{...}
    const normalized = unescaped
        // <written .../> -> :written{...}
        .replace(/<written\s+([^>]*?)\s*\/?>/g, (_m, attrs) => `:written{${attrs}}`)
        // :::written{...} ... ::: -> :written{...}
        .replace(/:::written\{([^}]*)\}[\s\S]*?:::/g, (_m, attrs) => `:written{${attrs}}`);
    return normalized;
}

// Helper function to process a valid JSON response
function processFlashcardResponse(
    parsedContent: any,
    topic: string,
): GenerationResult {
    // Extract the cards array - handle both array format and object with cards property
    let cards;
    if (Array.isArray(parsedContent)) {
        cards = parsedContent;
    } else if (parsedContent.cards && Array.isArray(parsedContent.cards)) {
        cards = parsedContent.cards;
    } else {
        // If we can't find a cards array, create a fallback with the available data
        cards = [];

        // Try to extract card data from the response in any format
        if (typeof parsedContent === "object") {
            // Look for properties that might contain card data
            for (const key in parsedContent) {
                if (
                    parsedContent[key] &&
                    typeof parsedContent[key] === "object" &&
                    parsedContent[key].question &&
                    parsedContent[key].answer
                ) {
                    cards.push(parsedContent[key]);
                }
            }
        }

        // If still no cards, create a fallback card
        if (cards.length === 0) {
            return createFallbackCards(topic);
        }
    }

    // Validate each card has question and answer properties
    const validCards = cards.filter(
        (card: any) => card && typeof card === "object" && card.question && card.answer,
    );

    // If no valid cards were found, create a fallback
    if (validCards.length === 0) {
        return createFallbackCards(topic);
    }

    return {
        cards: validCards.map((card: any) => ({
            question: card.question,
            answer: card.answer,
        })),
        topic,
        difficulty: "medium",
        created: new Date().toISOString(),
    };
}

// Helper function to manually extract cards from a non-JSON response
function extractCardsManually(responseText: string, topic: string): GenerationResult {
    const cards: GeneratedCard[] = [];

    // Try to extract question/answer pairs using regex patterns
    const questionAnswerPairs = responseText.match(
        /question["\s:]+([^"]+)["\s,]+answer["\s:]+([^"]+)/gi,
    );

    if (questionAnswerPairs && questionAnswerPairs.length > 0) {
        for (const pair of questionAnswerPairs) {
            const questionMatch = pair.match(/question["\s:]+([^"]+)/i);
            const answerMatch = pair.match(/answer["\s:]+([^"]+)/i);

            if (questionMatch && questionMatch[1] && answerMatch && answerMatch[1]) {
                cards.push({
                    question: questionMatch[1].trim(),
                    answer: answerMatch[1].trim(),
                });
            }
        }
    }

    // If we couldn't extract cards using regex, try to find question-answer patterns
    if (cards.length === 0) {
        const lines = responseText.split("\n").filter((line: string) => line.trim().length > 0);

        for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim();
            const nextLine = lines[i + 1].trim();

            // Look for patterns like "Q: ... A: ..." or numbered questions
            if (
                (line.startsWith("Q:") || line.match(/^\d+[.)]/)) &&
                (nextLine.startsWith("A:") || nextLine.match(/^Answer:/i))
            ) {
                cards.push({
                    question: line.replace(/^Q:|\d+[.)]/, "").trim(),
                    answer: nextLine.replace(/^A:|Answer:/i, "").trim(),
                });
                i++; // Skip the answer line since we've already processed it
            }
        }
    }

    // If we still couldn't extract cards, create fallback cards
    if (cards.length === 0) {
        return createFallbackCards(topic);
    }

    return {
        cards,
        topic,
        difficulty: "medium",
        created: new Date().toISOString(),
    };
}

// Helper function to create fallback cards when all else fails
function createFallbackCards(topic: string): GenerationResult {
    return {
        cards: [
            {
                question: `What is ${topic}?`,
                answer: "This card was generated as a fallback. Please try generating flashcards again.",
            },
            {
                question: `Describe the key concepts of ${topic}.`,
                answer: "This card was generated as a fallback. Please try generating flashcards again.",
            },
        ],
        topic,
        difficulty: "medium",
        created: new Date().toISOString(),
    };
}

/**
 * Format an existing note using Groq AI, given the note's current content and formatting guidelines.
 * Returns: { title: string, content: string }
 */
export async function formatNoteWithGroq(
    noteContent: string,
    formattingGuidelines?: string
): Promise<GeneratedNote> {
    const prompt = `You are an expert in Markdown note formatting. Your task is to take the following note and reformat it to be clearer, more visually structured, and easier to study from, following the provided formatting guidelines. Do not remove any information, but improve the structure, clarity, and Markdown usage. If the note lacks a clear title, generate one based on the content. If the note already has a good title, keep it. Use all relevant formatting features (headings, lists, info boxes, math, MCQ, fill-in-the-gap, dragdrop, etc.) where appropriate.

Formatting Guidelines:
${formattingGuidelines || `- Use # for main title, ## for sections, and further # for subsections
- Use bullet and numbered lists for lists
- Use info boxes (::color ... ::) for important points
- Use bold, italic, highlight, and inline code for emphasis
- Use LaTeX for math
- Use MCQ, fill-in-the-gap, and dragdrop blocks as in the app's syntax
- Use images as ![alt](url) or !(img)[query]
- Use tables for tabular data
- Use --- for section breaks
- Use links for references
- Make the note visually rich and easy to scan
`}

Here is the note to format:
"""
${noteContent}
"""

IMPORTANT: Output a valid JSON object with "title" (string) and "content" (string, Markdown formatted) properties. The response must be valid JSON that can be parsed by JSON.parse().`;

    const systemMessage =
        "You are an expert Markdown formatter. Your output must always be a valid JSON object with 'title' and 'content' (Markdown) properties. The response must be valid JSON that can be parsed by JSON.parse().";

    try {
        const response = await makeGroqRequest(prompt, false, systemMessage, true);
        let parsedContent;
        try {
            parsedContent = JSON.parse(response);
            if (
                parsedContent &&
                typeof parsedContent.title === "string" &&
                typeof parsedContent.content === "string"
            ) {
                return {
                    title: parsedContent.title,
                    content: unescapeGeneratedContent(parsedContent.content),
                };
            }
            throw new Error("Invalid note structure in JSON response");
        } catch (error) {
            // Try to extract title and content from the response
            const titleMatch = response.match(/"title"\s*:\s*"([^"]+)"/);
            const contentMatch = response.match(/"content"\s*:\s*"([^"]+)"/);
            if (titleMatch && contentMatch) {
                return {
                    title: titleMatch[1],
                    content: unescapeGeneratedContent(contentMatch[1]),
                };
            }
            throw new Error("Failed to parse formatted note JSON");
        }
    } catch (error) {
        console.error("Error formatting note with Groq:", error);
        return {
            title: "Formatted Note (Error)",
            content: `An error occurred while formatting the note. Please try again.\n\nOriginal content:\n${noteContent}`,
        };
    }
}