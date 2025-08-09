"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export type Environment = "dev" | "prod"

interface EnvironmentState {
  environment: Environment
  setEnvironment: (env: Environment) => void
}

const rawEnv = (process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.ENVIRONMENT || "prod").toLowerCase()
const normalized = rawEnv === "debug" ? "dev" : rawEnv
const initialEnv: Environment = normalized === "dev" ? "dev" : "prod"
export const useEnvironmentStore = create<EnvironmentState>()(
  persist(
    (set) => ({
      environment: initialEnv,
      setEnvironment: (env) => set({ environment: env }),
    }),
    {
      name: "ENVIRONMENT", // storage key
      storage: createJSONStorage(() => localStorage),
      // Only persist the environment value
      partialize: (state) => ({ environment: state.environment }),
    }
  )
)
