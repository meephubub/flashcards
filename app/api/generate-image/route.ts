import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { prompt, model = 'gpt-image-1', size = '512x512' } = await req.json()

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Invalid prompt' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 })
    }

    // Map common aliases to OpenAI model names
    const modelMap: Record<string, string> = {
      'gpt-image': 'gpt-image-1',
      'gpt-image-1': 'gpt-image-1',
      // Fallback for other names like 'flux-pro' or 'sdxl-turbo' to gpt-image-1
      'flux-pro': 'gpt-image-1',
      'sdxl-turbo': 'gpt-image-1',
    }
    const resolvedModel = modelMap[model] || modelMap['gpt-image']

    const resp = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: resolvedModel,
        prompt,
        size,
      }),
    })

    const data = await resp.json()
    if (!resp.ok) {
      const message = data?.error?.message || 'OpenAI image generation failed'
      return NextResponse.json({ error: message }, { status: resp.status })
    }

    // Normalized return: ensure { data: [{ url }] }
    // OpenAI returns { data: [{ url, b64_json? }] }
    return NextResponse.json({ data: data?.data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 })
  }
}
