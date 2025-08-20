import { NextResponse } from "next/server"
import * as dataService from "@/lib/data"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const deckId = Number.parseInt(params.id)
    const { front, back, front_img_url, back_img_url } = await request.json()

    if (!front || !back) {
      return NextResponse.json({ error: "Front and back content are required" }, { status: 400 })
    }

    const newCard = await dataService.addCard(supabase, deckId, front, back, front_img_url, back_img_url)

    if (!newCard) {
      return NextResponse.json({ error: "Failed to add card" }, { status: 500 })
    }

    return NextResponse.json(newCard)
  } catch (error) {
    return NextResponse.json({ error: "Failed to add card" }, { status: 500 })
  }
}
