"use client"

import * as React from "react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Plus, X } from "lucide-react"
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
  placeholder = "Add tags...",
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

  const handleRemoveTag = (tagToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation()
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      const newTag = inputValue.trim()
      if (newTag && !selectedTags.includes(newTag)) {
        onTagsChange([...selectedTags, newTag])
      }
      setInputValue("")
      setOpen(false)
    }
    if (e.key === "Escape") {
      setOpen(false)
    }
  }

  const filteredTags = availableTags.filter(tag => 
    !selectedTags.includes(tag) && 
    tag.toLowerCase().includes(inputValue.toLowerCase())
  )

  const showCreateNewTag = inputValue.trim() && !availableTags.includes(inputValue.trim()) && !selectedTags.includes(inputValue.trim())

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Render selected tags as minimal pills */}
      {selectedTags.map((tag) => (
        <div
          key={tag}
          className="group inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg text-sm font-light border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-150"
        >
          <span className="truncate max-w-[120px] tracking-wide">{tag}</span>
          <button
            type="button"
            onClick={(e) => handleRemoveTag(tag, e)}
            className="ml-1 rounded-full p-0.5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-150 opacity-60 hover:opacity-100"
            aria-label={`Remove ${tag} tag`}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      
      {/* Add tag button */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-sm font-light text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 rounded-lg transition-all duration-150"
          >
            <Plus className="w-3 h-3 mr-1.5" />
            {selectedTags.length === 0 ? placeholder : "Add"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700" align="start" side="top">
          <Command className="bg-transparent">
            <CommandInput
              placeholder="Search or create tags..."
              value={inputValue}
              onValueChange={setInputValue}
              onKeyDown={handleKeyDown}
              className="h-10 border-0 border-b border-gray-200 dark:border-gray-700 focus:border-gray-300 dark:focus:border-gray-600 focus:ring-0 bg-transparent text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
            />
            <CommandList className="max-h-[200px]">
              <CommandEmpty>
                {showCreateNewTag ? (
                  <CommandItem 
                    onSelect={handleCreateNewTag}
                    className="text-sm py-2.5 px-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2.5 text-gray-400" />
                    Create <span className="font-normal mx-1">"{inputValue.trim()}"</span>
                  </CommandItem>
                ) : (
                  <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                    No tags found. Type to create.
                  </div>
                )}
              </CommandEmpty>
              {filteredTags.length > 0 && (
                <CommandGroup className="p-1">
                  {filteredTags.map((tag) => (
                    <CommandItem
                      key={tag}
                      value={tag}
                      onSelect={() => handleSelectTag(tag)}
                      className="text-sm py-2 px-4 rounded-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
                    >
                      <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full mr-3 flex-shrink-0" />
                      <span className="truncate font-light">{tag}</span>
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
