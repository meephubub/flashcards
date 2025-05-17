import { NextResponse } from 'next/server';
import { makeGroqRequest } from '@/lib/groq';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Missing prompt parameter" },
        { status: 400 }
      );
    }

    // Create a system message for text analysis
    const systemMessage = `You are an expert educational assistant specializing in note analysis and learning support. Your role is to:

1. Provide clear, structured explanations
2. Connect ideas to broader concepts
3. Suggest learning strategies and memory techniques
4. Help identify knowledge gaps
5. Provide examples and analogies when helpful

Keep responses concise but comprehensive, using markdown formatting for clarity. Focus on helping the user understand and retain the information effectively.`;

    // Optimize the prompt for better processing
    const optimizedPrompt = `
I need you to analyze this note content and provide educational insights or answer the question about it.

${prompt}

Please structure your response to maximize learning and understanding:

1. Answer the question
   - Provide a clear, direct response to the query
   - Break down complex concepts into digestible parts
   - Use examples or analogies where helpful

2. Key Points
   - Highlight the most important concepts
   - Connect ideas to broader context
   - Note any potential misconceptions

3. Learning Tips
   - Suggest memory techniques or study strategies
   - Recommend related topics to explore
   - Provide practice questions if relevant

Use markdown formatting for improved readability:
- Use headings (## or ###) for main sections
- Use bullet points or numbered lists for key points
- Use emphasis (*italic* or **bold**) for important terms
- Use code blocks for technical content
- Use blockquotes for important callouts

Keep your response focused, educational, and directly relevant to the note content or question.`;

    // Call Groq API using existing utility function
    const responseText = await makeGroqRequest(
      optimizedPrompt,
      false,
      systemMessage
    );

    return NextResponse.json({ response: responseText });
  } catch (error: any) {
    console.error("Error calling Groq API:", error);
    return NextResponse.json(
      { error: error.message || "An error occurred during API call" },
      { status: 500 }
    );
  }
} 