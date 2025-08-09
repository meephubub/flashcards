import { create } from "zustand"

interface NoteDialogStore {
  open: boolean
  setOpen: (open: boolean) => void
  openDialog: () => void
  closeDialog: () => void
}

export const useNoteDialogStore = create<NoteDialogStore>((set) => ({
  open: false,
  setOpen: (open: boolean) => set({ open }),
  openDialog: () => set({ open: true }),
  closeDialog: () => set({ open: false }),
}))
