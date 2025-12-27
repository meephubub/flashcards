import { NextResponse } from 'next/server'
import { generateMathsQuestionWithGroq } from '@/lib/groq'

export async function POST(req: Request) {
    try {
        const { topic, difficulty, calculatorAllowed } = await req.json()

        if (!topic) {
            return NextResponse.json(
                { error: 'Missing required field: topic' },
                { status: 400 }
            )
        }

        const result = await generateMathsQuestionWithGroq(
            topic,
            difficulty || 'foundation',
            calculatorAllowed ?? true
        )

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Maths question generation error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to generate question' },
            { status: 500 }
        )
    }
}
