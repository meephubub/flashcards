import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: idString } = await params;
    const deckId = Number.parseInt(idString, 10);
    if (Number.isNaN(deckId)) {
      return NextResponse.json({ error: "Invalid deck id" }, { status: 400 });
    }

    // Verify ownership via RLS-guarded read (must belong to current user)
    const { data: deck, error: deckErr } = await supabase
      .from("decks")
      .select("id")
      .eq("id", deckId)
      .eq("user_id", user.id)
      .single();

    if (deckErr || !deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    const admin = createAdminClient();

    // Reuse existing active share token if present
    const { data: existing } = await admin
      .from("deck_shares")
      .select("token, revoked_at")
      .eq("deck_id", deckId)
      .maybeSingle();

    if (existing?.token && !existing.revoked_at) {
      return NextResponse.json({ token: existing.token });
    }

    const token =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const { error: upsertErr } = await admin.from("deck_shares").upsert(
      {
        deck_id: deckId,
        owner_id: user.id,
        token,
        revoked_at: null,
      },
      { onConflict: "deck_id" },
    );

    if (upsertErr) {
      return NextResponse.json(
        { error: "Failed to create share link" },
        { status: 500 },
      );
    }

    return NextResponse.json({ token });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to create share link" },
      { status: 500 },
    );
  }
}

