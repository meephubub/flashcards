import * as React from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import { ImageUpload } from "./ui/image-upload"

interface CardFormProps {
  onSubmit: (data: { front: string; back: string; front_img_url?: string | null; back_img_url?: string | null }) => void
  initialData?: { front: string; back: string; front_img_url?: string | null; back_img_url?: string | null }
  submitLabel?: string
}

export function CardForm({ onSubmit, initialData, submitLabel = "Add Card" }: CardFormProps) {
  const [front, setFront] = React.useState(initialData?.front || "")
  const [back, setBack] = React.useState(initialData?.back || "")
  const [frontImgUrl, setFrontImgUrl] = React.useState<string | null>(initialData?.front_img_url || null)
  const [backImgUrl, setBackImgUrl] = React.useState<string | null>(initialData?.back_img_url || null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ front, back, front_img_url: frontImgUrl, back_img_url: backImgUrl })
    if (!initialData) {
      setFront("")
      setBack("")
      setFrontImgUrl(null)
      setBackImgUrl(null)
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
        <Label>Front Image (Optional)</Label>
        <ImageUpload value={frontImgUrl} onChange={setFrontImgUrl} />
      </div>

      <div>
        <Label>Back Image (Optional)</Label>
        <ImageUpload value={backImgUrl} onChange={setBackImgUrl} />
      </div>

      <Button type="submit">{submitLabel}</Button>
    </form>
  )
}
 