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

Keep responses concise but comprehensive Focus on helping the user understand and retain the information effectively.`;

    // Optimize the prompt for better processing
    const optimizedPrompt = `
answer the users question concisely.
${prompt}

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