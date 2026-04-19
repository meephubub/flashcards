import * as React from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import { ImageUpload } from "./ui/image-upload"
import { DiagramEditor } from "./diagram-editor"
import { Music, Video, Square, Sparkles } from "lucide-react"

interface CardFormProps {
  onSubmit: (data: { 
    front: string; 
    back: string; 
    front_img_url?: string | null; 
    back_img_url?: string | null;
    audio_url?: string | null;
    video_url?: string | null;
    occlusion_data?: any | null;
  }) => void
  initialData?: { 
    front: string; 
    back: string; 
    front_img_url?: string | null; 
    back_img_url?: string | null;
    audio_url?: string | null;
    video_url?: string | null;
    occlusion_data?: any | null;
  }
  submitLabel?: string
}

export function CardForm({ onSubmit, initialData, submitLabel = "Add Card" }: CardFormProps) {
  const [front, setFront] = React.useState(initialData?.front || "")
  const [back, setBack] = React.useState(initialData?.back || "")
  const [frontImgUrl, setFrontImgUrl] = React.useState<string | null>(initialData?.front_img_url || null)
  const [backImgUrl, setBackImgUrl] = React.useState<string | null>(initialData?.back_img_url || null)
  const [audioUrl, setAudioUrl] = React.useState<string | null>(initialData?.audio_url || null)
  const [videoUrl, setVideoUrl] = React.useState<string | null>(initialData?.video_url || null)
  const [occlusionData, setOcclusionData] = React.useState<any | null>(initialData?.occlusion_data || null)
  const [isDiagramEditorOpen, setIsDiagramEditorOpen] = React.useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ 
      front, 
      back, 
      front_img_url: frontImgUrl, 
      back_img_url: backImgUrl,
      audio_url: audioUrl,
      video_url: videoUrl,
      occlusion_data: occlusionData
    })
    if (!initialData) {
      setFront("")
      setBack("")
      setFrontImgUrl(null)
      setBackImgUrl(null)
      setAudioUrl(null)
      setVideoUrl(null)
      setOcclusionData(null)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="front" className="text-xs font-bold uppercase tracking-widest opacity-50">Front (Question)</Label>
            <Textarea
              id="front"
              value={front}
              onChange={(e) => setFront(e.target.value)}
              required
              className="min-h-[120px] rounded-2xl bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:ring-black dark:focus:ring-white transition-all"
              placeholder="e.g. What is the capital of France?"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest opacity-50">Front Media</Label>
            <div className="space-y-3">
              <ImageUpload value={frontImgUrl} onChange={setFrontImgUrl} />
              {frontImgUrl && (
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsDiagramEditorOpen(true)}
                  className="w-full rounded-xl border-dashed"
                >
                  <Square className="h-4 w-4 mr-2" />
                  {occlusionData ? "Edit Occlusions" : "Add Diagram Occlusions"}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="back" className="text-xs font-bold uppercase tracking-widest opacity-50">Back (Answer)</Label>
            <Textarea
              id="back"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              required
              className="min-h-[120px] rounded-2xl bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:ring-black dark:focus:ring-white transition-all"
              placeholder="e.g. Paris"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest opacity-50">Back Media</Label>
            <ImageUpload value={backImgUrl} onChange={setBackImgUrl} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <div className="space-y-2">
          <Label htmlFor="audio" className="flex items-center text-xs font-bold uppercase tracking-widest opacity-50">
            <Music className="h-3 w-3 mr-1" /> Audio URL
          </Label>
          <Input 
            id="audio" 
            value={audioUrl || ""} 
            onChange={(e) => setAudioUrl(e.target.value || null)}
            placeholder="https://..."
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="video" className="flex items-center text-xs font-bold uppercase tracking-widest opacity-50">
            <Video className="h-3 w-3 mr-1" /> Video URL
          </Label>
          <Input 
            id="video" 
            value={videoUrl || ""} 
            onChange={(e) => setVideoUrl(e.target.value || null)}
            placeholder="https://..."
            className="rounded-xl"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button 
          type="submit" 
          className="rounded-full px-8 bg-zinc-900 hover:bg-black text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-black transition-all shadow-lg"
        >
          {submitLabel}
        </Button>
      </div>

      {isDiagramEditorOpen && frontImgUrl && (
        <DiagramEditor 
          imageUrl={frontImgUrl} 
          initialRects={occlusionData || []} 
          onSave={(rects) => {
            setOcclusionData(rects)
            setIsDiagramEditorOpen(false)
          }}
          onClose={() => setIsDiagramEditorOpen(false)}
        />
      )}
    </form>
  )
}

 