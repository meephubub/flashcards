export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      decks: {
        Row: {
          id: number
          name: string
          description: string
          card_count: number
          last_studied: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          name: string
          description?: string
          card_count?: number
          last_studied?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          description?: string
          card_count?: number
          last_studied?: string
          created_at?: string
          updated_at?: string
        }
      }
      cards: {
        Row: {
          id: number
          deck_id: number
          front: string
          back: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          deck_id: number
          front: string
          back: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          deck_id?: number
          front?: string
          back?: string
          created_at?: string
          updated_at?: string
        }
      }
      card_progress: {
        Row: {
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
        Insert: {
          id?: number
          card_id: number
          ease_factor: number
          interval: number
          repetitions: number
          due_date: string
          last_reviewed: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          card_id?: number
          ease_factor?: number
          interval?: number
          repetitions?: number
          due_date?: string
          last_reviewed?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
