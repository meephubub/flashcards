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
    const systemMessage = "You are a helpful assistant that analyzes text and answers questions about it. Keep your responses concise, informative, and well-structured. Format your response with Markdown where appropriate (headings, lists, emphasis, etc.) for clarity. Focus on providing accurate and helpful insights about the selected text.";

    // Optimize the prompt for better processing
    const optimizedPrompt = `
I need you to analyze the following text and provide insights or answer the question about it.

${prompt}

Respond with clear, concise analysis. Use markdown formatting for improved readability:
- Use headings (## or ###) for main points
- Use bullet points or numbered lists where appropriate
- Use emphasis (*italic* or **bold**) for key terms
- Use code blocks for technical content if needed

Keep your analysis focused, informative, and directly relevant to the text or question.
`;

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