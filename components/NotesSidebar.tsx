"use client";

import { Note } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface NotesSidebarProps {
  notes: Note[];
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onSelectNote: (noteId: string) => void;
  className?: string;
}

export function NotesSidebar({
  notes,
  categories,
  selectedCategory,
  onSelectCategory,
  onSelectNote,
  className,
}: NotesSidebarProps) {
  const notesForSelectedCategory =
    selectedCategory === "all"
      ? notes
      : notes.filter((note) => note.category === selectedCategory);

  return (
    <Card className={cn("h-full overflow-y-auto bg-neutral-900 text-neutral-100 border-r-0 rounded-none", className)}>
      <CardHeader className="sticky top-0 bg-neutral-900 z-10 p-4 border-b border-neutral-800">
        <CardTitle className="text-lg font-semibold text-neutral-100">Categories</CardTitle>
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
        {notesForSelectedCategory.length > 0 ? (
          notesForSelectedCategory.map((note) => (
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
          <p className="text-sm text-neutral-500 px-3 py-2">No notes in this category.</p>
        )}
      </CardContent>
    </Card>
  );
} 