import { NextResponse } from "next/server"
import * as dataService from "@/lib/data"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: idString } = await params
    const id = Number.parseInt(idString)
    const deck = await dataService.getDeck(supabase, id, user.id)

    if (!deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 })
    }

    return NextResponse.json(deck)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch deck" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { id: idString } = await params
    const id = Number.parseInt(idString)
    const updatedDeck = await request.json()

    // Ensure the ID doesn't change
    updatedDeck.id = id

    const result = await dataService.updateDeck(supabase, updatedDeck)

    if (!result) {
      return NextResponse.json({ error: "Failed to update deck" }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: "Failed to update deck" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { id: idString } = await params
    const id = Number.parseInt(idString)
    const success = await dataService.deleteDeck(supabase, id)

    if (!success) {
      return NextResponse.json({ error: "Failed to delete deck" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete deck" }, { status: 500 })
  }
}
