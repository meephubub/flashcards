import { NextResponse } from "next/server"
import * as dataService from "@/lib/data"
import { createClient } from "@/lib/supabase/server"
import type { CardProgress } from "@/lib/spaced-repetition"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; cardId: string }> }) {
  try {
    const supabase = await createClient()
    const { id, cardId: cardIdString } = await params
    const deckId = Number.parseInt(id)
    const cardId = Number.parseInt(cardIdString)
    const progress: CardProgress = await request.json()

    if (!progress) {
      return NextResponse.json({ error: "Progress data is required" }, { status: 400 })
    }

    const progressInput = {
      ease_factor: progress.easeFactor,
      interval: progress.interval,
      repetitions: progress.repetitions,
      due_date: progress.dueDate,
      last_reviewed: progress.lastReviewed,
      fsrs_state: progress.fsrsState as any, // Cast to any or Json compatible type
    }

    const success = await dataService.updateCardProgress(supabase, deckId, cardId, progressInput)

    if (!success) {
      return NextResponse.json({ error: "Failed to update card progress" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to update card progress" }, { status: 500 })
  }
}
