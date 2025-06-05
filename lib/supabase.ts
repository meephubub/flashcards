//supabase.ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from "@/types/supabase"
import type { CookieOptions } from '@supabase/ssr'

// For client-side only
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUB_API;

// Validate the environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  
  // Fallback for development
  if (typeof window !== 'undefined') {
    console.warn('Using fallback Supabase configuration for development');
  }
}

export const supabase = createBrowserClient<Database>(
  supabaseUrl || '',
  supabaseKey || '',
  {
    cookies: {
      get(name: string) {
        if (typeof document === 'undefined') return '';
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift() || '';
        return '';
      },
      set(name: string, value: string, options: CookieOptions) {
        if (typeof document === 'undefined') return;
        let cookie = `${name}=${value}`;
        if (options.path) cookie += `; path=${options.path}`;
        if (options.maxAge) cookie += `; max-age=${options.maxAge}`;
        if (options.domain) cookie += `; domain=${options.domain}`;
        if (options.sameSite) cookie += `; samesite=${options.sameSite}`;
        document.cookie = cookie;
      },
      remove(name: string, options: CookieOptions) {
        if (typeof document === 'undefined') return;
        let cookie = `${name}=; max-age=0`;
        if (options.path) cookie += `; path=${options.path}`;
        if (options.domain) cookie += `; domain=${options.domain}`;
        document.cookie = cookie;
      },
    },
  }
)

// Types for our database tables
export type Deck = {
  id: number;
  user_id: string | null;
  name: string;
  description: string | null;
  tag: string | null;
  card_count: number | null;
  last_studied: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type Card = {
  id: number
  deck_id: number
  front: string
  back: string
  img_url: string | null
  created_at: string
  updated_at: string
}

export type CardProgress = {
  id: number;
  user_id: string; // Added: Assumes progress is always tied to a user
  card_id: number;
  ease_factor: number;
  interval: number;
  repetitions: number;
  due_date: string; // Should be ISO string format
  last_reviewed: string; // Should be ISO string format
  created_at: string; // Should be ISO string format
  updated_at: string; // Should be ISO string format
};

// Type for the input payload when updating/creating card progress
export type CardProgressInput = {
  ease_factor: number;
  interval: number;
  repetitions: number;
  due_date: string;      // ISO string e.g., new Date().toISOString()
  last_reviewed: string; // ISO string e.g., new Date().toISOString()
};

// Structure for data imported from Markdown
export type ParsedDeckCardImport = {
  front: string;
  back: string;
  img_url?: string | null; // Optional image URL
};

export type ParsedDeckImport = {
  name: string;
  description?: string | null;
  cards: ParsedDeckCardImport[];
};

export type Note = {
  id: string
  title: string
  content: string
  category: string
  created_at: string
  updated_at: string
  user_id: string | null
}