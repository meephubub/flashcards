import { NextResponse } from "next/server";
import { gradeEssayWithGroq } from "@/lib/groq";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { subject, question, answer, maxMarks, context } = body;

        // Validate required fields
        if (!subject || !question || !answer || !maxMarks) {
            return NextResponse.json(
                { error: "Missing required fields: subject, question, answer, maxMarks" },
                { status: 400 }
            );
        }

        // Validate maxMarks is a positive number
        const marks = parseInt(maxMarks, 10);
        if (isNaN(marks) || marks <= 0 || marks > 50) {
            return NextResponse.json(
                { error: "maxMarks must be a positive number between 1 and 50" },
                { status: 400 }
            );
        }

        // Validate answer has content
        if (answer.trim().length < 10) {
            return NextResponse.json(
                { error: "Answer is too short. Please provide a more detailed response." },
                { status: 400 }
            );
        }

        // Grade the essay using Groq (with optional context)
        const result = await gradeEssayWithGroq(subject, question, answer, marks, context);

        return NextResponse.json(result);
    } catch (error) {
        console.error("Essay grading error:", error);
        return NextResponse.json(
            { error: "Failed to grade essay. Please try again." },
            { status: 500 }
        );
    }
}
