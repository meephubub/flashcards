"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { format } from "date-fns"
import { Calendar, Repeat, Zap, Brain, History, Info } from "lucide-react"

import { fsrs } from "ts-fsrs"

interface CardInfoDialogProps {
  card: any
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CardInfoDialog({ card, open, onOpenChange }: CardInfoDialogProps) {
  if (!card) return null

  const progress = card.progress || {}
  const fsrsState = progress.fsrsState || {}
  
  // Create a scheduler with default or saved params to calculate R
  const scheduler = fsrs(progress.fsrsParams || {})
  const retrievability = fsrsState.stability 
    ? scheduler.get_retrievability({ ...fsrsState, due: new Date(fsrsState.due) }, new Date(), false)
    : undefined

  const stats = [
    {
      label: "STATE",
      value: getStateLabel(fsrsState.state),
      icon: Brain,
    },
    {
      label: "STABILITY",
      value: formatStability(fsrsState.stability),
      icon: Zap,
    },
    {
      label: "DIFFICULTY",
      value: fsrsState.difficulty?.toFixed(2) || "0.00",
      icon: Info,
    },
    {
      label: "RETRIEVABILITY",
      value: retrievability !== undefined ? `${(retrievability * 100).toFixed(1)}%` : "N/A",
      icon: Zap,
    },
    {
      label: "REPS / LAPSES",
      value: `${fsrsState.reps || 0} / ${fsrsState.lapses || 0}`,
      icon: Repeat,
    },
    {
      label: "DUE",
      value: progress.dueDate ? format(new Date(progress.dueDate), "MMM d, yyyy") : "N/A",
      icon: Calendar,
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-white text-black p-0 overflow-hidden border-neutral-200">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            Card info
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-6 pt-2 space-y-6">
          <div className="grid grid-cols-3 border border-neutral-100 rounded-xl overflow-hidden">
            {stats.map((stat, i) => (
              <div 
                key={stat.label} 
                className={`p-4 flex flex-col gap-1.5 ${i < 3 ? 'border-b border-neutral-100' : ''} ${i % 3 !== 2 ? 'border-r border-neutral-100' : ''} bg-neutral-50/30`}
              >
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                  {stat.label}
                </span>
                <span className="text-base font-semibold text-neutral-900">
                  {stat.value}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-2 px-1">
              <History className="w-3 h-3" />
              Review History
            </h4>
            <div className="border border-neutral-100 rounded-xl overflow-hidden">
              <Table>
                <TableHeader className="bg-neutral-50/50">
                  <TableRow className="border-neutral-100 hover:bg-transparent">
                    <TableHead className="text-[10px] font-bold text-neutral-400 h-8">DATE</TableHead>
                    <TableHead className="text-[10px] font-bold text-neutral-400 h-8 text-center">RATING</TableHead>
                    <TableHead className="text-[10px] font-bold text-neutral-400 h-8 text-right">INTERVAL</TableHead>
                    <TableHead className="text-[10px] font-bold text-neutral-400 h-8 text-right">STABILITY</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-xs text-neutral-400">
                      No review history available yet.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function getStateLabel(state: number | undefined): string {
  switch (state) {
    case 0: return "New"
    case 1: return "Learning"
    case 2: return "Review"
    case 3: return "Relearning"
    default: return "New"
  }
}

function formatStability(stability: number | undefined): string {
  if (stability === undefined) return "0d"
  if (stability < 1) {
    const hours = Math.round(stability * 24)
    return `${hours}h`
  }
  return `${Math.round(stability)}d`
}
