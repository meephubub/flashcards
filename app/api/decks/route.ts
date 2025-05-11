import { NextResponse } from "next/server"
import * as dataService from "@/lib/data"

export async function GET() {
  try {
    const decks = await dataService.getDecks()
    return NextResponse.json(decks)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch decks" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { name, description } = await request.json()

    if (!name) {
      return NextResponse.json({ error: "Deck name is required" }, { status: 400 })
    }

    const newDeck = await dataService.createDeck(name, description || "")

    if (!newDeck) {
      return NextResponse.json({ error: "Failed to create deck" }, { status: 500 })
    }

    return NextResponse.json(newDeck)
  } catch (error) {
    return NextResponse.json({ error: "Failed to create deck" }, { status: 500 })
  }
}
