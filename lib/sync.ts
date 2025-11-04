import { createClient } from "@/lib/supabase/client"
import { saveNotesMeta, saveTasksMeta, saveDecksMeta, saveFoldersMeta, saveNoteContent, saveDeckCards, NoteMeta, TaskMeta, DeckMeta, FolderMeta, CardLite } from "@/lib/offline"

export async function syncAllMetadata(userId: string) {
  const supabase = createClient()
  const notesP = supabase
    .from("notes")
    .select("id, title, folder_id, content, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(500)
  const tasksP = supabase
    .from("homework")
    .select("id, subject, due_date, priority, done")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(500)
  const decksP = supabase
    .from("decks")
    .select("id, name, description")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500)
  const cardsP = supabase
    .from("cards")
    .select("id, deck_id, front, back, front_img_url, back_img_url, updated_at")
    .eq("user_id", userId)
    .limit(5000)
  const foldersP = supabase
    .from("folders")
    .select("id, name, parent_id")
    .eq("user_id", userId)
    .order("name", { ascending: true })

  const [notesRes, tasksRes, decksRes, cardsRes, foldersRes] = await Promise.all([notesP, tasksP, decksP, cardsP, foldersP])

  if (!notesRes.error) {
    const rows = (notesRes.data as Array<{ id: string; title: string | null; folder_id: string | null; content: string | null; updated_at: string | null }> ) || []
    const metas: NoteMeta[] = rows.map((r) => ({ id: r.id, title: r.title || "", folder_id: r.folder_id ?? null, public_url: `/notes?noteId=${encodeURIComponent(r.id)}` }))
    await saveNotesMeta(userId, metas)
    for (const r of rows) {
      await saveNoteContent(userId, { id: r.id, title: r.title || "", content: r.content || "", updated_at: r.updated_at })
    }
  }
  if (!tasksRes.error) {
    const rows = (tasksRes.data as Array<{ id: number; subject: string | null; due_date: string | null; priority: number | null; done: boolean | null }>) || []
    const metas: TaskMeta[] = rows.map((r) => ({ id: String(r.id), subject: r.subject, due_date: r.due_date, done: r.done ?? null, priority: r.priority ?? null }))
    await saveTasksMeta(userId, metas)
  }
  if (!decksRes.error) {
    const rows = (decksRes.data as Array<{ id: number; name: string; description: string | null }>) || []
    const metas: DeckMeta[] = rows.map((r) => ({ id: r.id, name: r.name, description: r.description || null }))
    await saveDecksMeta(userId, metas)
  }
  if (!cardsRes.error) {
    const rows = (cardsRes.data as Array<{ id: number; deck_id: number; front: string; back: string; front_img_url?: string | null; back_img_url?: string | null; updated_at?: string | null }> ) || []
    const byDeck = new Map<number, CardLite[]>()
    for (const c of rows) {
      const list = byDeck.get(c.deck_id) || []
      list.push({ id: c.id, front: c.front, back: c.back, front_img_url: c.front_img_url ?? null, back_img_url: c.back_img_url ?? null, updated_at: c.updated_at ?? null })
      byDeck.set(c.deck_id, list)
    }
    for (const [deckId, cards] of byDeck.entries()) {
      await saveDeckCards(userId, deckId, cards)
    }
  }
  if (!foldersRes.error) {
    const rows = (foldersRes.data as Array<{ id: string; name: string; parent_id: string | null }>) || []
    const metas: FolderMeta[] = rows.map((r) => ({ id: r.id, name: r.name, parent_id: r.parent_id ?? null }))
    await saveFoldersMeta(userId, metas)
  }
}
