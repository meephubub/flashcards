"use client"

import { AlertTriangle, RotateCcw, Edit3, Ban, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { CardProgress } from "@/lib/spaced-repetition"
import { getLeechStatus, LEECH_THRESHOLD } from "@/lib/spaced-repetition"

interface LeechAlertProps {
  progress: CardProgress | undefined
  onReset?: () => void
  onEdit?: () => void
  onSuspend?: () => void
  onDismiss?: () => void
  className?: string
}

export function LeechAlert({
  progress,
  onReset,
  onEdit,
  onSuspend,
  onDismiss,
  className,
}: LeechAlertProps) {
  if (!progress) return null

  const status = getLeechStatus(progress)

  if (!status.isLeech && status.failCount === 0) {
    return null
  }

  const isWarning = !status.isLeech && status.failCount > 0

  return (
    <Alert
      variant={isWarning ? "default" : "destructive"}
      className={`${className} ${isWarning ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20" : ""}`}
    >
      <AlertTriangle className={`h-4 w-4 ${isWarning ? "text-amber-600" : ""}`} />
      <div className="flex-1">
        <AlertTitle className={isWarning ? "text-amber-800 dark:text-amber-200" : ""}>
          {isWarning ? "Leech Warning" : "Leech Card Detected"}
        </AlertTitle>
        <AlertDescription className={isWarning ? "text-amber-700 dark:text-amber-300" : ""}>
          <p className="mt-1">{status.message}</p>
          <p className="text-xs mt-1 opacity-80">
            {isWarning
              ? "This card is getting difficult. Consider editing it to make it easier."
              : "This card is leeching your time. Action recommended:"}
          </p>
        </AlertDescription>

        <div className="flex flex-wrap gap-2 mt-3">
          {onReset && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className={`text-xs ${isWarning ? "border-amber-500/50 hover:bg-amber-100 dark:hover:bg-amber-900/30" : ""}`}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset Progress
            </Button>
          )}
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className={`text-xs ${isWarning ? "border-amber-500/50 hover:bg-amber-100 dark:hover:bg-amber-900/30" : ""}`}
            >
              <Edit3 className="h-3 w-3 mr-1" />
              Edit Card
            </Button>
          )}
          {onSuspend && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSuspend}
              className={`text-xs ${isWarning ? "border-amber-500/50 hover:bg-amber-100 dark:hover:bg-amber-900/30" : ""}`}
            >
              <Ban className="h-3 w-3 mr-1" />
              Suspend
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-xs ml-auto"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </Alert>
  )
}

export function LeechBadge({ progress }: { progress: CardProgress | undefined }) {
  if (!progress?.isLeech) return null

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
      <AlertTriangle className="h-3 w-3" />
      Leech
    </span>
  )
}

export function LeechCounter({ progress }: { progress: CardProgress | undefined }) {
  if (!progress || (progress.failCount || 0) === 0) return null

  const failCount = progress.failCount || 0
  const isLeech = progress.isLeech

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
        isLeech
          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
      }`}
      title={`${failCount} consecutive failure${failCount === 1 ? "" : "s"}${isLeech ? " - LEECH" : ""}`}
    >
      <AlertTriangle className="h-2.5 w-2.5" />
      {failCount}/{LEECH_THRESHOLD}
    </span>
  )
}
