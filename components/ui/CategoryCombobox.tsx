"use client"

import * as React from "react"
import { Check, ChevronsUpDown, PlusCircle, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// Add custom styles for separator and hide default search icon
const customStyles = `
  /* Hide the default search icon */
  [cmdk-input-wrapper] > svg {
    display: none !important;
  }
  
  /* Remove the default border */
  [cmdk-input-wrapper] {
    border-bottom: none !important;
  }
  
  /* Make separator more visible */
  [cmdk-separator] {
    background-color: rgba(200, 200, 200, 0.2) !important;
    height: 1px !important;
  }
`;

interface CategoryComboboxProps {
  categories: string[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  inputPlaceholder?: string;
  emptyPlaceholder?: string;
  buttonClassName?: string;
}

export function CategoryCombobox({
  categories,
  value,
  onChange,
  className,
  placeholder = "Select category...",
  inputPlaceholder = "Search or create...",
  emptyPlaceholder = "No category found.",
  buttonClassName
}: CategoryComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")

  const handleSelect = (currentValue: string) => {
    onChange(currentValue.toLowerCase() === value?.toLowerCase() ? "" : currentValue)
    setOpen(false)
    setInputValue("")
  }

  const handleCreateNew = () => {
    if (inputValue && !categories.find(cat => cat.toLowerCase() === inputValue.toLowerCase())) {
      onChange(inputValue.trim())
    }
    setOpen(false)
    setInputValue("")
  }

  const displayValue = value ? value.charAt(0).toUpperCase() + value.slice(1) : placeholder;

  return (
    <>
      <style jsx global>{customStyles}</style>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild className={className}>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between bg-neutral-900/70 border border-neutral-700 text-neutral-100 hover:bg-neutral-800 hover:text-neutral-50 hover:border-neutral-600 focus:border-neutral-500 focus:ring-1 focus:ring-neutral-600 shadow-sm transition-all duration-150",
              open && "bg-neutral-800 border-neutral-600 ring-1 ring-neutral-500",
              buttonClassName
            )}
          >
            <span className="ml-1">{displayValue}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform duration-150 ease-in-out" 
              style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} 
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-neutral-900 border-neutral-700 rounded-md shadow-xl overflow-hidden">
          <Command className="bg-neutral-900 border-neutral-700 rounded-none">
            <div className="flex items-center px-3 py-2 border-b border-neutral-700">
              <Search className="mr-2 h-4 w-4 shrink-0 text-neutral-100" />
              <CommandInput 
                placeholder={inputPlaceholder} 
                value={inputValue}
                onValueChange={setInputValue}
                className="bg-neutral-900 text-neutral-100 border-0 shadow-none outline-none px-0 py-1"
              />
            </div>
            <CommandList className="bg-neutral-900 text-neutral-100 max-h-[300px] py-2">
              <CommandEmpty className="bg-neutral-900 text-neutral-500 py-3 px-2">
                {inputValue.trim() ? (
                  <Button variant="ghost" className="w-full justify-start text-left h-auto bg-transparent text-sky-400 hover:bg-neutral-800 hover:text-sky-300 transition-colors duration-150 rounded-md px-3 py-2" onClick={handleCreateNew}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create "{inputValue.trim()}"
                  </Button>
                ) : (
                  <p className="text-center px-2">{emptyPlaceholder}</p>
                )}
              </CommandEmpty>
              <CommandGroup className="bg-neutral-900">
                {categories.map((category) => (
                  <CommandItem
                    key={category}
                    value={category}
                    onSelect={handleSelect}
                    className="hover:bg-neutral-800 aria-selected:bg-neutral-700 data-[selected=true]:bg-neutral-700 text-neutral-200 py-2 px-3 mx-1 rounded-md transition-colors duration-150 cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 text-sky-400 transition-opacity duration-150",
                        value?.toLowerCase() === category.toLowerCase() ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </CommandItem>
                ))}
              </CommandGroup>
              {inputValue.trim() && !categories.find(cat => cat.toLowerCase() === inputValue.toLowerCase()) && (
                <>
                  <CommandSeparator className="bg-neutral-600 my-2 h-px mx-3" />
                  <CommandGroup className="bg-neutral-900">
                      <CommandItem 
                          onSelect={handleCreateNew}
                          className="hover:bg-neutral-800 text-sky-400 hover:text-sky-300 py-2 px-3 mx-1 rounded-md transition-colors duration-150 cursor-pointer"
                          value={inputValue.trim()}
                      >
                          <PlusCircle className="mr-2 h-4 w-4" /> Create new category: "{inputValue.trim()}"
                      </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  )
} 