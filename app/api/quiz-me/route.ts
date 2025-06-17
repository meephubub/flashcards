import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function POST(req: NextRequest) {
  const { content, numQuestions = 5 } = await req.json();
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY not set' }, { status: 500 });
  }
  if (!content) {
    return NextResponse.json({ error: 'No content provided' }, { status: 400 });
  }

  // Prompt for GROQ to generate a variety of question types
  const prompt = `Given the following study material, generate ${numQuestions} quiz questions. Use a mix of types: multiple choice, fill-in-the-blank, true/false, and short answer. For each question, specify the type as one of: "mcq", "fill", "truefalse", or "short". For MCQs, provide 1 correct and 3 incorrect options. For fill-in-the-blank, use a blank (____) in the question. For true/false, provide the answer. For short answer, provide a concise answer. Return as a JSON array with fields: type, question, options (if any), answer.

Material:
"""
${content}
"""`;

  const groqRes = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama3-70b-8192',
      messages: [
        { role: 'system', content: 'You are a helpful quiz generator.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!groqRes.ok) {
    const error = await groqRes.text();
    return NextResponse.json({ error }, { status: 500 });
  }

  const data = await groqRes.json();
  // Try to extract the JSON array from the response
  let questions: any[] = [];
  try {
    const text = data.choices?.[0]?.message?.content || '';
    console.log('Raw GROQ response text:', text);
    // Find the first JSON array in the text
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      questions = JSON.parse(match[0]);
    } else {
      // fallback: try to parse the whole text
      questions = JSON.parse(text);
    }
  } catch (e) {
    return NextResponse.json({ error: 'Failed to parse questions from GROQ', details: e }, { status: 500 });
  }

  return NextResponse.json({ questions });
} 