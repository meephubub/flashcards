import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { xp } = await request.json()
    
    if (typeof xp !== 'number' || xp < 0) {
      return NextResponse.json({ error: "Invalid XP amount" }, { status: 400 })
    }

    // Update user XP by incrementing
    const { error: updateError } = await supabase.rpc('increment_user_xp', { 
      user_id: user.id, 
      increment_amount: xp 
    })

    if (updateError) {
      console.error("Error updating XP:", updateError)
      return NextResponse.json({ error: "Failed to update XP" }, { status: 500 })
    }

    return NextResponse.json({ success: true, xp })
  } catch (error) {
    console.error("XP update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user XP from user_stats table
    const { data: userData, error: fetchError } = await supabase
      .from('user_stats')
      .select('xp')
      .eq('user_id', user.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found" error
      console.error("Error fetching XP:", fetchError)
      return NextResponse.json({ error: "Failed to fetch XP" }, { status: 500 })
    }

    return NextResponse.json({ xp: userData?.xp || 0 })
  } catch (error) {
    console.error("XP fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
