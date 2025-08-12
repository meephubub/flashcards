import { create } from "zustand"

interface ProjectStore {
  selectedProject: string | null
  setSelectedProject: (name: string | null) => void
}

export const useProjectStore = create<ProjectStore>((set) => ({
  selectedProject: null,
  setSelectedProject: (name) => set({ selectedProject: name }),
}))
