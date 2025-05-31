import { NextRequest, NextResponse } from 'next/server'
import { getSettings, saveSettings, resetSettings } from '@/lib/settings'
import type { AppSettings } from '@/lib/settings'
import { createClient } from '@supabase/supabase-js'

// Create a Supabase client for server components
const createServerClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUB_API || ''
  return createClient(supabaseUrl, supabaseKey)
}

// GET /api/settings - Get user settings
export async function GET() {
  try {
    // Create a Supabase client for the route handler
    const supabase = createServerClient()
    
    // Check if user is authenticated
    const { data, error: authError } = await supabase.auth.getUser()
    
    if (authError || !data || !data.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get settings
    const settings = await getSettings(supabase)
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error in settings GET route:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

// PUT /api/settings - Update user settings
export async function PUT(request: NextRequest) {
  try {
    // Create a Supabase client for the route handler
    const supabase = createServerClient()
    
    // Check if user is authenticated
    const { data, error: authError } = await supabase.auth.getUser()
    
    if (authError || !data || !data.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get the settings from the request body
    const newSettings: AppSettings = await request.json()
    
    // Save the settings
    await saveSettings(supabase, newSettings)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in settings PUT route:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}

// POST /api/settings - Reset settings or other actions
export async function POST(request: NextRequest) {
  try {
    // Create a Supabase client for the route handler
    const supabase = createServerClient()
    
    // Check if user is authenticated
    const { data, error: authError } = await supabase.auth.getUser()
    
    if (authError || !data || !data.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    
    if (body.action === 'reset') {
      // Reset settings to default
      const defaultSettings = await resetSettings(supabase)
      return NextResponse.json(defaultSettings)
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in settings POST route:', error)
    return NextResponse.json(
      { error: 'Failed to process settings action' },
      { status: 500 }
    )
  }
}
