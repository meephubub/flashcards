import { NextResponse } from "next/server"
import * as dataService from "@/lib/data"
import { createClient } from "@/lib/supabase/server"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; cardId: string }> }) {
  try {
    const supabase = await createClient()
    const { id, cardId: cardIdString } = await params
    const deckId = Number.parseInt(id)
    const cardId = Number.parseInt(cardIdString)
    const { front, back, front_img_url, back_img_url } = await request.json()

    if (!front || !back) {
      return NextResponse.json({ error: "Front and back content are required" }, { status: 400 })
    }

    const updatedCard = await dataService.updateCard(supabase, deckId, cardId, front, back, front_img_url, back_img_url)

    if (!updatedCard) {
      return NextResponse.json({ error: "Failed to update card" }, { status: 500 })
    }

    return NextResponse.json(updatedCard)
  } catch (error) {
    return NextResponse.json({ error: "Failed to update card" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; cardId: string }> }) {
  try {
    const supabase = await createClient()
    const { id, cardId: cardIdString } = await params
    const deckId = Number.parseInt(id)
    const cardId = Number.parseInt(cardIdString)

    const success = await dataService.deleteCard(supabase, deckId, cardId)

    if (!success) {
      return NextResponse.json({ error: "Failed to delete card" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete card" }, { status: 500 })
  }
}
