import { Sidebar } from "@/components/sidebar"
import { DeckEditor } from "@/components/deck-editor"

export default function EditDeckPage({ params }: { params: { id: string } }) {
  return (
    <div className="flex h-screen bg-[#f5f5f7]">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <DeckEditor deckId={Number.parseInt(params.id)} />
      </main>
    </div>
  )
}
