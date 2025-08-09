import { create } from "zustand"

interface NoteContextStore {
  currentNoteId: string | null
  setCurrentNoteId: (id: string | null) => void
  deleteNoteById?: (id: string) => Promise<void> | void
  setDeleteNoteById: (fn: ((id: string) => Promise<void> | void) | undefined) => void
  openSelectNoteDialog?: () => void
  setOpenSelectNoteDialog: (fn: (() => void) | undefined) => void
}

export const useNoteContextStore = create<NoteContextStore>((set) => ({
  currentNoteId: null,
  setCurrentNoteId: (id) => set({ currentNoteId: id }),
  deleteNoteById: undefined,
  setDeleteNoteById: (fn) => set({ deleteNoteById: fn }),
  openSelectNoteDialog: undefined,
  setOpenSelectNoteDialog: (fn) => set({ openSelectNoteDialog: fn }),
}))
