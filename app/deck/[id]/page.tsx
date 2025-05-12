import { Sidebar } from "@/components/sidebar"
import { DeckView } from "@/components/deck-view"

export default async function DeckPage({ params }: { params: { id: string } }) {
  const resolvedParams = await params
  const deckId = Number.parseInt(resolvedParams.id)
  
  return (
    <div className="flex h-screen bg-[#f5f5f7]">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <DeckView deckId={deckId} />
      </main>
    </div>
  )
}
