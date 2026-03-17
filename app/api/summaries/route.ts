import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = createAdminClient()

    const [{ data: digests, error: digestsError }, { data: summaries, error: summariesError }] =
      await Promise.all([
        admin.from("daily_digests").select("*").order("date", { ascending: false }).limit(30),
        admin
          .from("email_summaries")
          .select("id, sender, subject, received_at, summary, priority, priority_reason")
          .order("received_at", { ascending: false })
          .limit(500),
      ])

    if (digestsError) {
      return NextResponse.json({ error: digestsError.message }, { status: 500 })
    }
    if (summariesError) {
      return NextResponse.json({ error: summariesError.message }, { status: 500 })
    }

    return NextResponse.json({
      digests: digests || [],
      summaries: summaries || [],
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 })
  }
}

