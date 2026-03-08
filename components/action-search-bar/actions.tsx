import { Action } from "./types"
import { Globe, BarChart2, PlaneTakeoff, PlusCircle, Download, Search, GitMerge, AudioLines, HelpCircle, ImageIcon, Pencil, Trash2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useNoteContextStore } from "@/hooks/use-note-context"

// We can't use hooks directly here if this is just a constant file, 
// but we can define the static actions. 
// Actions that require hooks or state (like "Question") will need to be enhanced in the component or have their 'run' methods implemented there.

export const allActions: Action[] = [
    // Navigation
    {
        id: "go-home",
        label: "Go to Home",
        description: "/",
        icon: <Globe className="h-4 w-4 text-blue-500" />,
    short: "Enter",
        end: "⌘K",
        href: "/",
        category: "nav",
        priority: 90,
    },
    {
        id: "go-notes",
        label: "Go to Notes",
        description: "/notes",
        icon: <BarChart2 className="h-4 w-4 text-orange-500" />,
    short: "Enter",
        end: "⌘K",
        href: "/notes",
        category: "nav",
        priority: 90,
    },
    {
        id: "go-signin",
        label: "Go to Sign In",
        description: "/sign-in",
        icon: <PlaneTakeoff className="h-4 w-4 text-red-500" />,
    short: "Enter",
        end: "⌘K",
        href: "/sign-in",
        category: "nav",
        priority: 10,
    },
    // Deck actions
    {
        id: "create-deck",
        label: "Create deck",
        description: "Open create deck dialog",
        icon: <PlusCircle className="h-4 w-4 text-emerald-600" />,
    short: "Enter",
        end: "Decks",
        run: () => {
            try { window.dispatchEvent(new Event('open-create-deck')) } catch { }
        },
        category: "decks",
        priority: 80,
    },
    {
        id: "import-markdown",
        label: "Import markdown",
        description: "Import cards from Markdown",
        icon: <Download className="h-4 w-4 text-blue-600" />,
    short: "Enter",
        end: "Decks",
        run: () => {
            try { window.dispatchEvent(new Event('open-import-markdown')) } catch { }
        },
        category: "decks",
        priority: 70,
    },
    {
        id: "generate-flashcards",
        label: "Generate flashcards (AI)",
        description: "Create flashcards with AI",
        icon: <Search className="h-4 w-4 text-purple-600" />,
    short: "Enter",
        end: "AI",
        run: () => {
            try { window.dispatchEvent(new Event('open-generate-flashcards')) } catch { }
        },
        category: "ai",
        priority: 85,
    },
    {
        id: "merge-decks",
        label: "Merge decks",
        description: "Combine two decks",
        icon: <GitMerge className="h-4 w-4 text-pink-600" />,
    short: "Enter",
        end: "Decks",
        run: () => {
            try { window.dispatchEvent(new Event('open-merge-decks')) } catch { }
        },
        category: "decks",
        priority: 60,
    },
    {
        id: "create-model",
        label: "Create model",
        description: "Open create model dialog",
        icon: <PlusCircle className="h-4 w-4 text-emerald-600" />,
    short: "Enter",
        end: "Models",
        run: () => {
            try { window.dispatchEvent(new Event('open-create-model')) } catch { }
        },
        category: "models",
        priority: 70,
    },
    {
        id: "question",
        label: "Question",
        icon: <HelpCircle className="h-4 w-4 text-blue-500" />,
    description: "gpt-4o",
        short: "⌘cmd+p",
        end: "Command",
        run: () => {
            // Filled at runtime by ActionSearchBar via effectiveActions mapping if needed
        },
        category: "ai",
        priority: 95,
    },
    {
        id: "fan-on",
        label: "Fan On",
        icon: <AudioLines className="h-4 w-4 text-green-500" />,
    description: "Trigger Voicemonkey",
        short: "",
        end: "Device",
        run: () => {
            // Fire-and-forget; modal will close after run
            void fetch(
                "https://api-v2.voicemonkey.io/trigger?token=814e797e65ae46a6828e1001150bd8ac_0a30f8185cdd6014f8a9b1d0ef1b326a&device=fan-on"
            )
        },
        category: "device",
        priority: 20,
    },
    {
        id: "fan-off",
        label: "Fan Off",
        icon: <AudioLines className="h-4 w-4 text-red-500" />,
    description: "Trigger Voicemonkey",
        short: "",
        end: "Device",
        run: () => {
            // Fire-and-forget; modal will close after run
            void fetch(
                "https://api-v2.voicemonkey.io/trigger?token=814e797e65ae46a6828e1001150bd8ac_0a30f8185cdd6014f8a9b1d0ef1b326a&device=fan-off"
            )
        },
        category: "device",
        priority: 20,
    },
    {
        id: "create-note-from-image",
        label: "Create note from image",
        description: "Upload image → process → create note",
        icon: <ImageIcon className="h-4 w-4 text-purple-500" />,
    short: "Enter",
        end: "Image → Note",
        run: () => {
            // Implementation will be handled in the component due to DOM interaction requirements
        },
        category: "notes",
        priority: 85,
    },
]
