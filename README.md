# Flashcards

A modern flashcard application built with Next.js, React, and Supabase for effective learning and knowledge retention.

## Features

- **Deck Management**: Create, edit, and organize flashcard decks with tags
- **Study Modes**: 
  - Regular study mode with spaced repetition
  - Exam mode for testing knowledge
  - Language study mode for language learning
- **AI Integration**:
  - Generate flashcards automatically from text
  - AI assistant to help with studying
  - AI-powered grading of answers
- **Import/Export**: Import flashcards from Markdown files
- **Notes System**: Create and organize study notes
- **Progress Tracking**: Track your learning progress over time

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS, Radix UI
- **Backend**: Next.js API routes, Supabase
- **Database**: PostgreSQL (via Supabase)
- **AI**: Transformers.js (Hugging Face), OpenAI API
- **Styling**: Tailwind CSS, shadcn/ui components

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Supabase account

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/flashcards.git
   cd flashcards
   ```

2. Install dependencies
   ```bash
   npm install
   # or
   yarn install
   ```

3. Set up environment variables
   Create a `.env.local` file in the root directory with the following variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

4. Initialize the database
   Run the development server and navigate to `/api/db-setup` to set up the database tables.

5. Start the development server
   ```bash
   npm run dev
   # or
   yarn dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Desktop Application

This web application can be packaged as a desktop application using Pake (Tauri-based).

### Custom Title Bar

To create a custom title bar for the desktop application:

1. Use the `--hide-title-bar` flag when building the Pake app:
   ```bash
   pake <url> --name Flashcards --hide-title-bar
   ```

2. For local Pake development, set `hideTitleBar: true` in `pake.json`

3. The web application includes a custom title bar component that uses:
   - `data-tauri-drag-region` HTML attribute for draggable regions
   - `@tauri-apps/api/window` for window control functions (minimize, maximize, close)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.