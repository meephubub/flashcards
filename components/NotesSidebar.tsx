"use client";

import { Note } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SearchIcon, XIcon } from "lucide-react";

interface NotesSidebarProps {
  notes: Note[];
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onSelectNote: (noteId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  className?: string;
}

export function NotesSidebar({
  notes,
  categories,
  selectedCategory,
  onSelectCategory,
  onSelectNote,
  searchQuery,
  onSearchChange,
  onClearSearch,
  className,
}: NotesSidebarProps) {
  const notesForSelectedCategory =
    selectedCategory === "all"
      ? notes
      : notes.filter((note) => note.category === selectedCategory);

  // Filter notes by search query (searches in both title and content)
  const filteredNotes = searchQuery.trim() 
    ? notesForSelectedCategory.filter((note) =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : notesForSelectedCategory;

  return (
    <Card className={cn("h-full overflow-y-auto bg-neutral-900 text-neutral-100 border-r-0 rounded-none", className)}>
      <CardHeader className="sticky top-0 bg-neutral-900 z-10 p-4 border-b border-neutral-800">
        <div className="flex flex-col space-y-4">
          <CardTitle className="text-lg font-semibold text-neutral-100">Categories</CardTitle>
          
          {/* Search Bar */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 pr-10 py-2 h-9 bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500 rounded-lg w-full"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClearSearch}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50 rounded-full p-1"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 space-y-1">
        <Button
          variant={selectedCategory === "all" ? "secondary" : "ghost"}
          className={cn(
            "w-full justify-start px-3 py-2 text-sm rounded-md",
            selectedCategory === "all" 
              ? "bg-neutral-700 text-white"
              : "text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100"
          )}
          onClick={() => onSelectCategory("all")}
        >
          All Notes
        </Button>
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? "secondary" : "ghost"}
            className={cn(
              "w-full justify-start px-3 py-2 text-sm rounded-md",
              selectedCategory === category 
                ? "bg-neutral-700 text-white"
                : "text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100"
            )}
            onClick={() => onSelectCategory(category)}
          >
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </Button>
        ))}
      </CardContent>

      <CardHeader className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] bg-neutral-900 z-10 p-4 border-t border-b border-neutral-800">
        <CardTitle className="text-lg font-semibold text-neutral-100">Notes</CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-1">
        {filteredNotes.length > 0 ? (
          filteredNotes.map((note) => (
            <Button
              key={note.id}
              variant="ghost"
              className="w-full justify-start text-left h-auto whitespace-normal px-3 py-2 text-sm rounded-md text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100"
              onClick={() => onSelectNote(note.id)}
            >
              {note.title}
            </Button>
          ))
        ) : (
          <p className="text-sm text-neutral-500 px-3 py-2">
            {searchQuery.trim() 
              ? "No notes match your search." 
              : "No notes in this category."}
          </p>
        )}
      </CardContent>
    </Card>
  );
} 