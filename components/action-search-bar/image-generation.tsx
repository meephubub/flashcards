import { useState, useEffect } from "react"
import { ImageIcon, Copy } from "lucide-react"

interface ImageGenerationProps {
    prompt: string
}

export function ImageGeneration({ prompt }: ImageGenerationProps) {
    const [loading, setLoading] = useState(false)
    const [url, setUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        const generate = async () => {
            if (!prompt) return
            try {
                setLoading(true)
                setError(null)
                setUrl(null)
                const encodedPrompt = encodeURIComponent(prompt)
                const generatedUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?model=flux-pro&width=1024&height=1024`
                setUrl(generatedUrl)

                // Preload image
                const img = new Image()
                img.src = generatedUrl
            } catch (err: any) {
                console.error('Image generation failed', err)
                setError(err?.message || 'Image generation failed')
            } finally {
                setLoading(false)
            }
        }

        // Simple debounce/delay to avoid thrashing if typing fast, 
        // though usually this component is mounted *after* Enter key in the main bar logic.
        // If it's live preview, we might want to wait for a pause.
        // Assuming passed prompt is final or user desires generation.
        generate()
    }, [prompt])

    return (
        <div className="w-full px-4 pb-2 -mt-2">
            <div className="rounded-lg border border-black/5 dark:border-white/10 bg-white/90 dark:bg-neutral-800/90 px-3 py-2 text-sm flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Generate Image</div>
                </div>
                <div className="text-gray-900 dark:text-gray-100 font-medium whitespace-pre-wrap break-words">
                    {prompt}
                </div>
                {loading && <div className="text-xs text-gray-600 dark:text-gray-400">Generating…</div>}
                {error && <div className="text-xs text-red-500">{error}</div>}
                {url && (
                    <div className="flex flex-col gap-2">
                        <div className="w-full overflow-hidden rounded-md border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 p-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="Generated" className="max-h-64 mx-auto rounded" />
                        </div>
                        <div className="flex items-center gap-2">
                            <code className="text-[11px] break-all text-gray-700 dark:text-gray-300 bg-neutral-100 dark:bg-neutral-900 px-2 py-1 rounded border border-black/5 dark:border-white/10 flex-1">{url}</code>
                            <button
                                type="button"
                                onClick={async () => {
                                    if (url) {
                                        await navigator.clipboard.writeText(url)
                                        setCopied(true)
                                        setTimeout(() => setCopied(false), 1000)
                                    }
                                }}
                                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 text-gray-800 dark:text-gray-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            >
                                <Copy className="w-4 h-4" />
                                <span className="text-xs">{copied ? 'Copied' : 'Copy URL'}</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
