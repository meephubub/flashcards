"use client"

import { useState } from "react"
import { AlertTriangle, X } from "lucide-react"
import { useEnvironmentStore } from "@/hooks/use-environment"

export default function EnvBanner() {
  const env = useEnvironmentStore((s) => s.environment)
  const [dismissed, setDismissed] = useState(false)

  if (env !== "dev" || dismissed) return null

  return (
    <div className="w-full bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
      <div className="mx-auto max-w-6xl px-3 py-2 flex items-center justify-center text-center relative">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium">
            Caution: You are running in DEV mode. Middleware relaxations may apply. Version: {process.env.NEXT_PUBLIC_APP_VERSION}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="absolute right-0 pr-3 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
          Dismiss
        </button>
      </div>
    </div>
  )
}
