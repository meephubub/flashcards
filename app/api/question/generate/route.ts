import { NextResponse } from 'next/server'
import { makeGroqRequest } from '@/lib/groq'

export async function POST(req: Request) {
    try {
        const { subject, sources, marks } = await req.json()

        if (!subject || !sources || !marks) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        const systemPrompt = `You are an expert GCSE examiner for ${subject}.
Your task is to create a challenging and appropriate exam question based on the provided source material.
The question should be worth ${marks} marks.
Output ONLY the question text. Do not include "Question:" or any other preamble.`

        const userPrompt = `Subject: ${subject}
Source Material:
${sources}

Generate a GCSE exam question based on this material worth ${marks} marks.`

        const response = await makeGroqRequest(userPrompt, false, systemPrompt)

        return NextResponse.json({ question: response })
    } catch (error: any) {
        console.error('Question generation error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to generate question' },
            { status: 500 }
        )
    }
}
