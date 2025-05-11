import { NextResponse } from "next/server"
import * as dataService from "@/lib/data"
import type { CardProgress } from "@/lib/spaced-repetition"

export async function PUT(request: Request, { params }: { params: { id: string; cardId: string } }) {
  try {
    const deckId = Number.parseInt(params.id)
    const cardId = Number.parseInt(params.cardId)
    const progress: CardProgress = await request.json()

    if (!progress) {
      return NextResponse.json({ error: "Progress data is required" }, { status: 400 })
    }

    const success = await dataService.updateCardProgress(deckId, cardId, progress)

    if (!success) {
      return NextResponse.json({ error: "Failed to update card progress" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to update card progress" }, { status: 500 })
  }
}
