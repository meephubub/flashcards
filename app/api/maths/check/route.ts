import { NextResponse } from 'next/server'
import { gradeMathsAnswerWithGroq } from '@/lib/groq'

export async function POST(req: Request) {
    try {
        const { question, userAnswer, expectedAnswer, maxMarks, topic } = await req.json()

        if (!question || !userAnswer || !maxMarks) {
            return NextResponse.json(
                { error: 'Missing required fields: question, userAnswer, maxMarks' },
                { status: 400 }
            )
        }

        const result = await gradeMathsAnswerWithGroq(
            question,
            userAnswer,
            expectedAnswer || '',
            maxMarks,
            topic || 'general'
        )

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Maths answer checking error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to check answer' },
            { status: 500 }
        )
    }
}
