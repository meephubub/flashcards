import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - pdf-parse doesn't have types
import pdf from 'pdf-parse/lib/pdf-parse.js';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Check file type
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
        }

        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
        }

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Parse PDF
        const data = await pdf(buffer);

        // Return extracted text
        return NextResponse.json({
            text: data.text,
            pages: data.numpages,
            info: data.info,
        });
    } catch (error) {
        console.error('PDF parsing error:', error);
        return NextResponse.json({ error: 'Failed to parse PDF' }, { status: 500 });
    }
}
