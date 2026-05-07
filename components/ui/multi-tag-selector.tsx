"use client"

import * as React from "react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Tag, X } from "lucide-react"
import { useState } from "react"

interface MultiTagSelectorProps {
  availableTags: string[]
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  placeholder?: string
  className?: string
}

export function MultiTagSelector({
  availableTags,
  selectedTags,
  onTagsChange,
  placeholder = "Select tags...",
  className
}: MultiTagSelectorProps) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState("")

  const handleSelectTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      onTagsChange([...selectedTags, tag])
    }
    setInputValue("")
    setOpen(false)
  }

  const handleRemoveTag = (tagToRemove: string) => {
    onTagsChange(selectedTags.filter(tag => tag !== tagToRemove))
  }

  const handleCreateNewTag = () => {
    const newTag = inputValue.trim()
    if (newTag && !selectedTags.includes(newTag)) {
      onTagsChange([...selectedTags, newTag])
    }
    setInputValue("")
    setOpen(false)
  }

  const filteredTags = availableTags.filter(tag => 
    !selectedTags.includes(tag) && 
    tag.toLowerCase().includes(inputValue.toLowerCase())
  )

  const showCreateNewTag = inputValue.trim() && !availableTags.includes(inputValue.trim()) && !selectedTags.includes(inputValue.trim())

  return (
    <div className={cn("flex flex-wrap gap-2 p-2 border rounded-md min-h-[42px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2", className)}>
      {selectedTags.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className="gap-1 pr-1"
        >
          <Tag className="w-3 h-3" />
          {tag}
          <button
            type="button"
            onClick={() => handleRemoveTag(tag)}
            className="ml-1 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Tag className="w-3 h-3 mr-1" />
            {selectedTags.length === 0 ? placeholder : "Add tag"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search tags..."
              value={inputValue}
              onValueChange={setInputValue}
              className="h-9"
            />
            <CommandList>
              <CommandEmpty>
                {showCreateNewTag ? (
                  <CommandItem onSelect={handleCreateNewTag}>
                    Create "{inputValue.trim()}"
                  </CommandItem>
                ) : (
                  <div className="py-2 text-center text-sm text-muted-foreground">
                    No tags found.
                  </div>
                )}
              </CommandEmpty>
              {filteredTags.length > 0 && (
                <CommandGroup>
                  {filteredTags.map((tag) => (
                    <CommandItem
                      key={tag}
                      value={tag}
                      onSelect={() => handleSelectTag(tag)}
                    >
                      <Tag className="w-3 h-3 mr-2" />
                      {tag}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
