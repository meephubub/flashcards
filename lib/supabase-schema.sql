-- Create decks table
CREATE TABLE IF NOT EXISTS decks (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  tag TEXT,
  card_count INTEGER DEFAULT 0,
  last_studied TEXT DEFAULT 'Never',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create cards table
CREATE TABLE IF NOT EXISTS cards (
  id SERIAL PRIMARY KEY,
  deck_id INTEGER REFERENCES decks(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  img_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create card_progress table for spaced repetition
CREATE TABLE IF NOT EXISTS card_progress (
  id SERIAL PRIMARY KEY,
  card_id INTEGER REFERENCES cards(id) ON DELETE CASCADE,
  ease_factor FLOAT NOT NULL DEFAULT 2.5,
  interval INTEGER NOT NULL DEFAULT 0,
  repetitions INTEGER NOT NULL DEFAULT 0,
  due_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_reviewed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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

-- Create AI agent conversations table
CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  user_id UUID,
  title TEXT,
  messages JSONB NOT NULL DEFAULT '[]',
  agent_type TEXT DEFAULT 'general',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create AI agent tools table for storing available tools
CREATE TABLE IF NOT EXISTS agent_tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  tool_type TEXT NOT NULL,
  config JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_card_progress_card_id ON card_progress(card_id);
CREATE INDEX IF NOT EXISTS idx_card_progress_due_date ON card_progress(due_date);
CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_session_id ON agent_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_user_id ON agent_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_status ON agent_conversations(status);
CREATE INDEX IF NOT EXISTS idx_agent_tools_name ON agent_tools(name);
CREATE INDEX IF NOT EXISTS idx_agent_tools_active ON agent_tools(is_active);

-- Add RLS policies
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tools ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (you may want to restrict this in a real app)
CREATE POLICY "Allow public access to decks" ON decks FOR ALL USING (true);
CREATE POLICY "Allow public access to cards" ON cards FOR ALL USING (true);
CREATE POLICY "Allow public access to card_progress" ON card_progress FOR ALL USING (true);
CREATE POLICY "Allow public access to notes" ON notes FOR ALL USING (true);
CREATE POLICY "Allow public access to agent_conversations" ON agent_conversations FOR ALL USING (true);
CREATE POLICY "Allow public access to agent_tools" ON agent_tools FOR ALL USING (true);

-- Insert some default agent tools
INSERT INTO agent_tools (name, description, tool_type, config) VALUES
('web_search', 'Search the web for current information', 'search', '{"provider": "duckduckgo", "max_results": 5}'),
('file_reader', 'Read and analyze uploaded files', 'file', '{"supported_formats": ["txt", "pdf", "docx", "md"]}'),
('calculator', 'Perform mathematical calculations', 'calculator', '{"precision": 10}'),
('image_generator', 'Generate images from text descriptions', 'image', '{"provider": "render", "models": ["flux-pro", "dall-e-3"]}'),
('code_analyzer', 'Analyze and explain code snippets', 'code', '{"languages": ["javascript", "python", "typescript", "java", "cpp"]}'),
('translator', 'Translate text between languages', 'translation', '{"provider": "google", "languages": ["en", "es", "fr", "de", "ja", "zh"]}')
ON CONFLICT (name) DO NOTHING;
