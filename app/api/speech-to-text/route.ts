import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioBlob = formData.get('file');
    const format = formData.get('format') || 'wav';
    if (!audioBlob || !(audioBlob instanceof Blob)) {
      return NextResponse.json({ error: 'Missing audio file' }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing GROQ_API_KEY' }, { status: 500 });
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: (() => {
        const fd = new FormData();
        fd.append('file', audioBlob, `audio.${format}`);
        fd.append('model', 'whisper-large-v3');
        return fd;
      })()
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      return NextResponse.json({ error: err }, { status: 502 });
    }

    const data = await groqRes.json();
    return NextResponse.json({ text: data.text });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
