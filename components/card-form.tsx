import * as React from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import { ImageUpload } from "./ui/image-upload"

interface CardFormProps {
  onSubmit: (data: { front: string; back: string; img_url?: string | null }) => void
  initialData?: { front: string; back: string; img_url?: string | null }
  submitLabel?: string
}

export function CardForm({ onSubmit, initialData, submitLabel = "Add Card" }: CardFormProps) {
  const [front, setFront] = React.useState(initialData?.front || "")
  const [back, setBack] = React.useState(initialData?.back || "")
  const [img_url, setImgUrl] = React.useState<string | null>(initialData?.img_url || null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ front, back, img_url })
    if (!initialData) {
      setFront("")
      setBack("")
      setImgUrl(null)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="front">Front</Label>
        <Textarea
          id="front"
          value={front}
          onChange={(e) => setFront(e.target.value)}
          required
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="back">Back</Label>
        <Textarea
          id="back"
          value={back}
          onChange={(e) => setBack(e.target.value)}
          required
          className="mt-1"
        />
      </div>

      <div>
        <Label>Image (Optional)</Label>
        <ImageUpload value={img_url} onChange={setImgUrl} className="mt-1" />
      </div>

      <Button type="submit">{submitLabel}</Button>
    </form>
  )
} 