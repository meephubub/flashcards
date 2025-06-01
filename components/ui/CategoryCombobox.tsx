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
  theme?: "dark" | "light";
}

export function CategoryCombobox({
  categories,
  value,
  onChange,
  className,
  placeholder = "Select category...",
  inputPlaceholder = "Search or create...",
  emptyPlaceholder = "No category found.",
  buttonClassName,
  theme = "dark"
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
              "w-full justify-between shadow-sm transition-all duration-150",
              theme === "dark" 
                ? [
                    "bg-neutral-900/70 border border-neutral-700 text-neutral-100 hover:bg-neutral-800 hover:text-neutral-50 hover:border-neutral-600 focus:border-neutral-500 focus:ring-1 focus:ring-neutral-600",
                    open && "bg-neutral-800 border-neutral-600 ring-1 ring-neutral-500"
                  ]
                : [
                    "bg-white border border-gray-300 text-gray-900 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400",
                    open && "bg-gray-50 border-gray-400 ring-1 ring-gray-400"
                  ],
              buttonClassName
            )}
          >
            <span className="ml-1">{displayValue}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform duration-150 ease-in-out" 
              style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} 
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent className={`w-[--radix-popover-trigger-width] p-0 rounded-md shadow-xl overflow-hidden ${theme === "dark" ? "bg-neutral-900 border-neutral-700" : "bg-white border-gray-200"}`}>
          <Command className={`rounded-none ${theme === "dark" ? "bg-neutral-900 border-neutral-700" : "bg-white border-gray-200"}`}>
            <div className={`flex items-center px-3 py-2 border-b ${theme === "dark" ? "border-neutral-700" : "border-gray-200"}`}>
              <Search className={`mr-2 h-4 w-4 shrink-0 ${theme === "dark" ? "text-neutral-100" : "text-gray-600"}`} />
              <CommandInput 
                placeholder={inputPlaceholder} 
                value={inputValue}
                onValueChange={setInputValue}
                className={`border-0 shadow-none outline-none px-0 py-1 ${theme === "dark" ? "bg-neutral-900 text-neutral-100" : "bg-white text-gray-900"}`}
              />
            </div>
            <CommandList className={`max-h-[300px] py-2 ${theme === "dark" ? "bg-neutral-900 text-neutral-100" : "bg-white text-gray-900"}`}>
              <CommandEmpty className={`py-3 px-2 ${theme === "dark" ? "bg-neutral-900 text-neutral-500" : "bg-white text-gray-500"}`}>
                {inputValue.trim() ? (
                  <Button variant="ghost" className={`w-full justify-start text-left h-auto bg-transparent transition-colors duration-150 rounded-md px-3 py-2 ${theme === "dark" ? "text-sky-400 hover:bg-neutral-800 hover:text-sky-300" : "text-blue-600 hover:bg-gray-100 hover:text-blue-700"}`} onClick={handleCreateNew}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create "{inputValue.trim()}"
                  </Button>
                ) : (
                  <p className="text-center px-2">{emptyPlaceholder}</p>
                )}
              </CommandEmpty>
              <CommandGroup className={theme === "dark" ? "bg-neutral-900" : "bg-white"}>
                {categories.map((category) => (
                  <CommandItem
                    key={category}
                    value={category}
                    onSelect={handleSelect}
                    className={`py-2 px-3 mx-1 rounded-md transition-colors duration-150 cursor-pointer ${theme === "dark" ? "hover:bg-neutral-800 aria-selected:bg-neutral-700 data-[selected=true]:bg-neutral-700 text-neutral-200" : "hover:bg-gray-100 aria-selected:bg-gray-200 data-[selected=true]:bg-gray-200 text-gray-700"}`}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 transition-opacity duration-150",
                        theme === "dark" ? "text-sky-400" : "text-blue-600",
                        value?.toLowerCase() === category.toLowerCase() ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </CommandItem>
                ))}
              </CommandGroup>
              {inputValue.trim() && !categories.find(cat => cat.toLowerCase() === inputValue.toLowerCase()) && (
                <>
                  <CommandSeparator className={`my-2 h-px mx-3 ${theme === "dark" ? "bg-neutral-600" : "bg-gray-200"}`} />
                  <CommandGroup className={theme === "dark" ? "bg-neutral-900" : "bg-white"}>
                      <CommandItem 
                          onSelect={handleCreateNew}
                          className={`py-2 px-3 mx-1 rounded-md transition-colors duration-150 cursor-pointer ${theme === "dark" ? "hover:bg-neutral-800 text-sky-400 hover:text-sky-300" : "hover:bg-gray-100 text-blue-600 hover:text-blue-700"}`}
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