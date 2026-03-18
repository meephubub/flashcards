import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idString } = await params
    const body = await req.json().catch(() => ({} as any))
    const summaryIds = body?.summaryIds

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = createAdminClient()

    // Delete the underlying email summaries first.
    if (Array.isArray(summaryIds) && summaryIds.length > 0) {
      const { error: emailDelError } = await admin.from("email_summaries").delete().in("id", summaryIds)
      if (emailDelError) {
        return NextResponse.json({ error: emailDelError.message }, { status: 500 })
      }
    }

    const { error: digestDelError } = await admin.from("daily_digests").delete().eq("id", idString)
    if (digestDelError) {
      return NextResponse.json({ error: digestDelError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 })
  }
}

