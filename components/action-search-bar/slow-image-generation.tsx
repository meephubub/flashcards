import { useState, useEffect } from "react"
import { ImageIcon, Loader2, Download, X } from "lucide-react"
import { generateImage as generateSlowImageApi, type ImageModel } from "@/lib/generate-image"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface SlowImageGenerationProps {
    prompt: string
}

const imageModels: ImageModel[] = [
    "flux", "turbo", "gptimage", "together", "dall-e-3",
    "sdxl-1.0", "sdxl-l", "sdxl-turbo", "sd-3.5-large",
    "flux-pro", "flux-dev", "flux-schnell", "flux-canny", "midjourney", "ideogram-v3-quality", "imagen-4.0-ultra-generate", "flux-1.1-pro"
]

export function SlowImageGeneration({ prompt }: SlowImageGenerationProps) {
    const [loading, setLoading] = useState(false)
    const [url, setUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [selectedModel, setSelectedModel] = useState<ImageModel>("flux-pro")
    const [expanded, setExpanded] = useState(false)
    const [scale, setScale] = useState(1)
    const [translate, setTranslate] = useState({ x: 0, y: 0 })
    const [dragging, setDragging] = useState(false)
    const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null)

    // Reset zoom when image changes or closes
    useEffect(() => {
        if (!expanded || !url) {
            setScale(1)
            setTranslate({ x: 0, y: 0 })
            setDragging(false)
            setLastPos(null)
        }
    }, [expanded, url])

    const generate = async () => {
        if (!prompt) return
        try {
            setLoading(true)
            setError(null)
            setUrl(null)
            const res = await generateSlowImageApi(prompt, selectedModel)
            const b64 = res?.data?.[0]?.b64_json
            if (!b64) throw new Error('No image payload returned')
            const isHttp = typeof b64 === 'string' && (b64.startsWith('http://') || b64.startsWith('https://'))
            const isData = typeof b64 === 'string' && b64.startsWith('data:')
            const finalUrl = isData ? b64 : (isHttp ? b64 : `data:image/png;base64,${b64}`)
            setUrl(finalUrl)
        } catch (err: any) {
            console.error('Slow image generation failed', err)
            setError(err?.message || 'Slow image generation failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-full px-4 pb-2 -mt-2">
            <div className="rounded-lg border border-black/5 dark:border-white/10 bg-white/90 dark:bg-neutral-800/90 px-3 py-2 text-sm flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Generate Slow Image</div>
                </div>
                <div className="text-gray-900 dark:text-gray-100 font-medium whitespace-pre-wrap break-words">
                    {prompt || 'Type a prompt after “generate slow image:”'}
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 dark:text-gray-400">Model</label>
                    <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as ImageModel)}>
                        <SelectTrigger className="h-7 w-48">
                            <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent align="start">
                            {imageModels.map((m) => (
                                <SelectItem key={m} value={m}>
                                    {m}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <button
                        type="button"
                        onClick={generate}
                        disabled={loading || !prompt}
                        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 text-gray-800 dark:text-gray-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
                    >
                        {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>) : 'Generate'}
                    </button>
                </div>
                {loading && (
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin" /> This may take a while…
                    </div>
                )}
                {error && <div className="text-xs text-red-500">{error}</div>}
                {url && (
                    <div className="flex flex-col gap-2">
                        <div
                            className={`relative w-full overflow-hidden rounded-md border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 ${expanded ? 'p-1' : 'p-2'}`}
                            onWheel={(e) => {
                                if (!expanded) return
                                e.preventDefault()
                                const delta = -e.deltaY
                                const factor = delta > 0 ? 1.1 : 0.9
                                const next = Math.min(8, Math.max(1, scale * factor))
                                setScale(next)
                            }}
                            onMouseDown={(e) => {
                                if (!expanded) return
                                e.preventDefault()
                                setDragging(true)
                                setLastPos({ x: e.clientX, y: e.clientY })
                            }}
                            onMouseMove={(e) => {
                                if (!expanded || !dragging || !lastPos) return
                                e.preventDefault()
                                const dx = e.clientX - lastPos.x
                                const dy = e.clientY - lastPos.y
                                setTranslate((t) => ({ x: t.x + dx, y: t.y + dy }))
                                setLastPos({ x: e.clientX, y: e.clientY })
                            }}
                            onMouseUp={() => { if (dragging) { setDragging(false); setLastPos(null) } }}
                            onMouseLeave={() => { if (dragging) { setDragging(false); setLastPos(null) } }}
                        >
                            {expanded && (
                                <button
                                    type="button"
                                    aria-label="Close expanded image"
                                    className="absolute top-2 right-2 z-10 inline-flex items-center justify-center rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-neutral-800/80 backdrop-blur px-1.5 py-1 hover:bg-white dark:hover:bg-neutral-800"
                                    onClick={() => setExpanded(false)}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={url}
                                alt="Generated"
                                className={
                                    expanded
                                        ? 'w-full h-auto max-h-[70vh] object-contain rounded'
                                        : 'max-h-64 mx-auto rounded cursor-zoom-in'
                                }
                                style={expanded ? {
                                    transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                                    transformOrigin: 'center center',
                                    cursor: scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-out',
                                    transition: dragging ? 'none' : 'transform 40ms linear'
                                } : undefined}
                                onClick={() => setExpanded((v) => !v)}
                            />
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="button"
                                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 text-gray-800 dark:text-gray-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                onClick={async () => {
                                    try {
                                        const filename = `image-${Date.now()}.png`
                                        const link = document.createElement('a')
                                        if (url.startsWith('data:')) {
                                            link.href = url
                                            link.download = filename
                                            document.body.appendChild(link)
                                            link.click()
                                            document.body.removeChild(link)
                                        } else {
                                            const resp = await fetch(url)
                                            const blob = await resp.blob()
                                            const fileUrl = URL.createObjectURL(blob)
                                            link.href = fileUrl
                                            link.download = filename
                                            document.body.appendChild(link)
                                            link.click()
                                            document.body.removeChild(link)
                                            URL.revokeObjectURL(fileUrl)
                                        }
                                    } catch (e) {
                                        console.error('Save failed', e)
                                    }
                                }}
                            >
                                <Download className="w-4 h-4" />
                                <span className="text-xs">Save</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
