export interface Action {
    id: string
    label: string
    icon?: React.ReactNode
    description?: string
    short?: string
    end?: string
    href?: string
    run?: () => void
    // If true, keep the palette open after run(). We'll manage closing manually.
    keepOpen?: boolean
    // Category for grouping/filtering in the left rail
    category?:
    | "basic"
    | "ai"
    | "notes"
    | "decks"
    | "models"
    | "nav"
    | "device"
    | "todos"
    // Higher appears earlier when searching (in addition to matching score)
    priority?: number
}

export interface SearchResult {
    actions: Action[]
}
