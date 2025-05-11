import { NextResponse } from "next/server"
import * as dataService from "@/lib/data"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number.parseInt(params.id)
    const deck = await dataService.getDeck(id)

    if (!deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 })
    }

    return NextResponse.json(deck)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch deck" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number.parseInt(params.id)
    const updatedDeck = await request.json()

    // Ensure the ID doesn't change
    updatedDeck.id = id

    const result = await dataService.updateDeck(updatedDeck)

    if (!result) {
      return NextResponse.json({ error: "Failed to update deck" }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: "Failed to update deck" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number.parseInt(params.id)
    const success = await dataService.deleteDeck(id)

    if (!success) {
      return NextResponse.json({ error: "Failed to delete deck" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete deck" }, { status: 500 })
  }
}
