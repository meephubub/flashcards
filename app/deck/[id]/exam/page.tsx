import { Sidebar } from "@/components/sidebar"
import { ExamMode } from "@/components/exam-mode"

export default function ExamPage({ params }: { params: { id: string } }) {
  return (
    <div className="flex h-screen bg-[#f5f5f7]">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <ExamMode deckId={Number.parseInt(params.id)} />
      </main>
    </div>
  )
}
