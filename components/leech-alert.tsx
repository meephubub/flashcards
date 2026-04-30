"use client"

import { AlertTriangle, RotateCcw, Edit3, Ban, X, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Compact Pill Button with Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`h-7 px-2 text-xs rounded-full border gap-1 ${
              isWarning
                ? "border-amber-500/50 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-900/30"
                : "border-red-500/50 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-900/30"
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            <span className="hidden sm:inline">
              {isWarning ? `Warning ${status.failCount}/${LEECH_THRESHOLD}` : "Leech"}
            </span>
            <span className="sm:hidden">
              {status.failCount}/{LEECH_THRESHOLD}
            </span>
            <ChevronDown className="h-3 w-3 ml-0.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-40">
          {isWarning ? (
            <div className="px-2 py-1.5 text-xs text-amber-600 dark:text-amber-400 border-b mb-1">
              {status.failCount} failure{status.failCount === 1 ? "" : "s"} (leech at {LEECH_THRESHOLD})
            </div>
          ) : (
            <div className="px-2 py-1.5 text-xs text-red-600 dark:text-red-400 border-b mb-1">
              Leech detected - card needs attention
            </div>
          )}
          {onReset && (
            <DropdownMenuItem onClick={onReset} className="text-xs cursor-pointer">
              <RotateCcw className="h-3.5 w-3.5 mr-2" />
              Reset Progress
            </DropdownMenuItem>
          )}
          {onEdit && (
            <DropdownMenuItem onClick={onEdit} className="text-xs cursor-pointer">
              <Edit3 className="h-3.5 w-3.5 mr-2" />
              Edit Card
            </DropdownMenuItem>
          )}
          {onSuspend && (
            <DropdownMenuItem onClick={onSuspend} className="text-xs cursor-pointer">
              <Ban className="h-3.5 w-3.5 mr-2" />
              Suspend Card
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dismiss Button (optional, small) */}
      {onDismiss && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="h-6 w-6 p-0 text-neutral-400 hover:text-neutral-600"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
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
