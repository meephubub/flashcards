import { create } from "zustand"

interface NoteContextStore {
  currentNoteId: string | null
  setCurrentNoteId: (id: string | null) => void
  deleteNoteById?: (id: string) => Promise<void> | void
  setDeleteNoteById: (fn: ((id: string) => Promise<void> | void) | undefined) => void
  openSelectNoteDialog?: () => void
  setOpenSelectNoteDialog: (fn: (() => void) | undefined) => void
  startEditCurrentNote?: () => void
  setStartEditCurrentNote: (fn: (() => void) | undefined) => void
  // Provide current note data (title/content) to other components (e.g., ActionSearchBar)
  getCurrentNoteForExam?: () => { title: string; content: string } | null
  setGetCurrentNoteForExam: (fn: (() => { title: string; content: string } | null) | undefined) => void
  // Control embedded exam mode when viewing notes
  showExamInNotes: boolean
  setShowExamInNotes: (show: boolean) => void
  // Allow external components (e.g., ActionSearchBar) to push updated content into current view state
  updateCurrentNoteContent?: (content: string) => void
  setUpdateCurrentNoteContent: (fn: ((content: string) => void) | undefined) => void
}

export const useNoteContextStore = create<NoteContextStore>((set) => ({
  currentNoteId: null,
  setCurrentNoteId: (id) => set({ currentNoteId: id }),
  deleteNoteById: undefined,
  setDeleteNoteById: (fn) => set({ deleteNoteById: fn }),
  openSelectNoteDialog: undefined,
  setOpenSelectNoteDialog: (fn) => set({ openSelectNoteDialog: fn }),
  startEditCurrentNote: undefined,
  setStartEditCurrentNote: (fn) => set({ startEditCurrentNote: fn }),
  getCurrentNoteForExam: undefined,
  setGetCurrentNoteForExam: (fn) => set({ getCurrentNoteForExam: fn }),
  showExamInNotes: false,
  setShowExamInNotes: (show) => set({ showExamInNotes: show }),
  updateCurrentNoteContent: undefined,
  setUpdateCurrentNoteContent: (fn) => set({ updateCurrentNoteContent: fn }),
}))
