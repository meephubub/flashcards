import { Sidebar } from "@/components/sidebar"
import { StudyMode } from "@/components/study-mode"

export default function StudyPage({ params }: { params: { id: string } }) {
  return (
    <div className="flex h-screen bg-[#f5f5f7]">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <StudyMode deckId={Number.parseInt(params.id)} />
      </main>
    </div>
  )
}
