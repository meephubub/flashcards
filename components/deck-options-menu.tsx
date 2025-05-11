"use client"

import type React from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Edit, Copy, Download, Trash2 } from "lucide-react"
import { useDecks } from "@/context/deck-context"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface DeckOptionsMenuProps {
  deckId: number
}

export function DeckOptionsMenu({ deckId }: DeckOptionsMenuProps) {
  const { deleteDeck } = useDecks()
  const { toast } = useToast()
  const router = useRouter()

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (confirm("Are you sure you want to delete this deck? This action cannot be undone.")) {
      try {
        await deleteDeck(deckId)
        toast({
          title: "Deck deleted",
          description: "The deck has been successfully deleted.",
        })
        router.push("/")
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete deck. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem asChild>
          <Link href={`/deck/${deckId}/edit`}>
            <Edit className="h-4 w-4 mr-2" />
            Rename
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Copy className="h-4 w-4 mr-2" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Download className="h-4 w-4 mr-2" />
          Export
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-600 dark:text-red-400" onClick={handleDelete}>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
