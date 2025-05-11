import { Sidebar } from "@/components/sidebar"
import { DeckView } from "@/components/deck-view"

export default function DeckPage({ params }: { params: { id: string } }) {
  return (
    <div className="flex h-screen bg-[#f5f5f7]">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <DeckView deckId={Number.parseInt(params.id)} />
      </main>
    </div>
  )
}
