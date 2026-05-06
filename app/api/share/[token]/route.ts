import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: share, error: shareErr } = await admin
      .from("deck_shares")
      .select("deck_id, revoked_at")
      .eq("token", token)
      .maybeSingle();

    if (shareErr || !share || share.revoked_at) {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }

    const { data: deck, error: deckErr } = await admin
      .from("decks")
      .select("id, user_id, name, description, tag, card_count, exclude_from_srs")
      .eq("id", share.deck_id)
      .single();

    if (deckErr || !deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    // Select "*" to avoid coupling to optional feature columns (audio/video/occlusion/etc).
    const { data: cards, error: cardsErr } = await admin
      .from("cards")
      .select("*")
      .eq("deck_id", share.deck_id)
      .order("id", { ascending: true })
      .limit(10000);

    if (cardsErr) {
      return NextResponse.json({ error: "Failed to load cards" }, { status: 500 });
    }

    return NextResponse.json({
      deck: {
        id: deck.id,
        user_id: deck.user_id,
        name: deck.name,
        description: deck.description ?? "",
        tag: deck.tag ?? null,
        card_count: deck.card_count ?? (cards?.length ?? 0),
        last_studied: "Never",
        cards: cards ?? [],
        exclude_from_srs: deck.exclude_from_srs ?? false,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to load shared deck" }, { status: 500 });
  }
}

