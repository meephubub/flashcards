import { haptics } from "@/lib/haptics"
import { Action } from "./types"
import { Search, Globe, BarChart2, PlaneTakeoff, PlusCircle, Download, GitMerge, AudioLines, HelpCircle, ImageIcon, Pencil, Trash2, ListTodo } from "lucide-react"

interface ActionCategoryRailProps {
    selectedCategory: 'all' | 'ai' | 'notes' | 'decks' | 'nav' | 'todos'
    onSelectCategory: (category: 'all' | 'ai' | 'notes' | 'decks' | 'nav' | 'todos') => void
}

export function ActionCategoryRail({ selectedCategory, onSelectCategory }: ActionCategoryRailProps) {
    const categories: { id: typeof selectedCategory; label: string; icon: React.ReactNode }[] = [
        { id: 'all', label: 'All', icon: <Search className="w-4 h-4" /> },
        { id: 'notes', label: 'Notes', icon: <Pencil className="w-4 h-4" /> },
        { id: 'decks', label: 'Decks', icon: <GitMerge className="w-4 h-4" /> },
        { id: 'ai', label: 'AI', icon: <HelpCircle className="w-4 h-4" /> },
        { id: 'nav', label: 'Nav', icon: <Globe className="w-4 h-4" /> },
        { id: 'todos', label: 'Todos', icon: <ListTodo className="w-4 h-4" /> },
    ]

    return (
        <div className="hidden sm:flex flex-col gap-1 p-2 border-r border-black/5 dark:border-white/10 min-w-12 bg-white/40 dark:bg-neutral-900/40">
            {categories.map(cat => (
                <button
                    key={cat.id}
                    type="button"
                    title={cat.label}
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors ${selectedCategory === cat.id ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}
                    onClick={() => {
                        haptics.navigation()
                        onSelectCategory(cat.id)
                    }}
                >
                    {cat.icon}
                </button>
            ))}
        </div>
    )
}
