import { Sidebar } from "@/components/sidebar"
import { DeckGrid } from "@/components/deck-grid"

export default function Home() {
  return (
    <div className="flex h-screen bg-[#f5f5f7]">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <DeckGrid />
      </main>
    </div>
  )
}
