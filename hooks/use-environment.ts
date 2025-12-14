"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export type Environment = "dev" | "prod"

interface EnvironmentState {
  environment: Environment
  setEnvironment: (env: Environment) => void
}

// Read env vars lazily to avoid HMR issues with module-scope process.env access
const getInitialEnvironment = (): Environment => {
  if (typeof window === "undefined") return "prod"
  const rawEnv = (process.env.NEXT_PUBLIC_ENVIRONMENT || "prod").toLowerCase()
  const normalized = rawEnv === "debug" ? "dev" : rawEnv
  return normalized === "dev" ? "dev" : "prod"
}

export const useEnvironmentStore = create<EnvironmentState>()(
  persist(
    (set, get) => ({
      environment: "prod", // Default, will be overwritten by persisted value or hydration
      setEnvironment: (env) => set({ environment: env }),
    }),
    {
      name: "ENVIRONMENT",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ environment: state.environment }),
      // Use onRehydrateStorage to set initial value if nothing persisted
      onRehydrateStorage: () => (state) => {
        if (state && state.environment === "prod") {
          // If still default, check env var
          const envFromVar = getInitialEnvironment()
          if (envFromVar !== state.environment) {
            state.setEnvironment(envFromVar)
          }
        }
      },
    }
  )
)
