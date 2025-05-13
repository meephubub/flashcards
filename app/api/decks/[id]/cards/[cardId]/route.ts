import { NextResponse } from "next/server"
import * as dataService from "@/lib/data"

export async function PUT(request: Request, { params }: { params: { id: string; cardId: string } }) {
  try {
    const deckId = Number.parseInt(params.id)
    const cardId = Number.parseInt(params.cardId)
    const { front, back, img_url } = await request.json()

    if (!front || !back) {
      return NextResponse.json({ error: "Front and back content are required" }, { status: 400 })
    }

    const updatedCard = await dataService.updateCard(deckId, cardId, front, back, img_url)

    if (!updatedCard) {
      return NextResponse.json({ error: "Failed to update card" }, { status: 500 })
    }

    return NextResponse.json(updatedCard)
  } catch (error) {
    return NextResponse.json({ error: "Failed to update card" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string; cardId: string } }) {
  try {
    const deckId = Number.parseInt(params.id)
    const cardId = Number.parseInt(params.cardId)

    const success = await dataService.deleteCard(deckId, cardId)

    if (!success) {
      return NextResponse.json({ error: "Failed to delete card" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete card" }, { status: 500 })
  }
}
