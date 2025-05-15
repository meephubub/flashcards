import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Create a Supabase client with the service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Execute raw SQL to create the notes table
    const { error } = await supabaseAdmin.rpc('execute_sql', {
      query: `
        -- Create notes table
        CREATE TABLE IF NOT EXISTS notes (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          category TEXT NOT NULL,
          user_id UUID,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Add index for performance
        CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category);
        
        -- Add RLS policy
        ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
        
        -- Create policy for public access
        CREATE POLICY "Allow public access to notes" ON notes FOR ALL USING (true);
      `
    });

    if (error) {
      console.error('Error creating notes table:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Notes table created successfully' });
  } catch (error: any) {
    console.error('Server error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
} 