import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

// For client-side only
export const supabaseClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUB_API!
)

// Alternative initialization with error handling
export const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUB_API
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
  }
  
  return createClient<Database>(supabaseUrl, supabaseKey)
}

// Types for our database tables
export type Deck = {
  id: number
  name: string
  description: string
  card_count: number
  last_studied: string
  created_at: string
  updated_at: string
}

export type Card = {
  id: number
  deck_id: number
  front: string
  back: string
  created_at: string
  updated_at: string
}

export type CardProgress = {
  id: number
  card_id: number
  ease_factor: number
  interval: number
  repetitions: number
  due_date: string
  last_reviewed: string
  created_at: string
  updated_at: string
}
