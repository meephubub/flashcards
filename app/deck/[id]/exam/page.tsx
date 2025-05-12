import { Sidebar } from "@/components/sidebar"
import { ExamMode } from "@/components/exam-mode"

export default async function ExamPage({ params }: { params: { id: string } }) {
  const deckId = Number.parseInt(params.id)

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <ExamMode deckId={deckId} />
      </main>
    </div>
  )
}
