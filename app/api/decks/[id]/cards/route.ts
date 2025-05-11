import { NextResponse } from "next/server"
import * as dataService from "@/lib/data"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const deckId = Number.parseInt(params.id)
    const { front, back } = await request.json()

    if (!front || !back) {
      return NextResponse.json({ error: "Front and back content are required" }, { status: 400 })
    }

    const newCard = await dataService.addCard(deckId, front, back)

    if (!newCard) {
      return NextResponse.json({ error: "Failed to add card" }, { status: 500 })
    }

    return NextResponse.json(newCard)
  } catch (error) {
    return NextResponse.json({ error: "Failed to add card" }, { status: 500 })
  }
}
