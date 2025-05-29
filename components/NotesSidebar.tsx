"use client";

import { Note } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SearchIcon, XIcon, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/theme-provider";

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
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
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
    <Card className={cn("h-full overflow-y-auto border-r-0 rounded-none", 
      isDark 
        ? "bg-neutral-900 text-neutral-100" 
        : "bg-white text-gray-900", 
      className
    )}>
      <CardHeader className={`sticky top-0 z-10 p-4 border-b ${isDark ? "bg-neutral-900 border-neutral-800" : "bg-white border-gray-200"}`}>
        <div className="flex items-center justify-between mb-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push('/')} 
            className={`h-8 w-8 p-1.5 -ml-2 ${isDark ? "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}
            aria-label="Go back to homepage"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <CardTitle className={`text-lg font-semibold ${isDark ? "text-neutral-100" : "text-gray-900"}`}>Categories</CardTitle>
          {/* Placeholder for potential right-aligned item if Categories title needs to be centered or if another icon goes here */}
          <div className="w-8"></div> {/* This helps keep Categories title centered if needed, adjust or remove if layout is different */}
        </div>
        <div className="flex flex-col space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className={`pl-10 pr-10 py-2 h-9 rounded-lg w-full ${isDark 
                ? "bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500" 
                : "bg-gray-100 border-gray-200 text-gray-900 placeholder:text-gray-500 focus:border-gray-300 focus:ring-gray-300"}`}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClearSearch}
                className={`absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 rounded-full p-1 ${isDark 
                  ? "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50" 
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/70"}`}
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
              ? isDark ? "bg-neutral-700 text-white" : "bg-gray-200 text-gray-900"
              : isDark 
                ? "text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100" 
                : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
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
                ? isDark ? "bg-neutral-700 text-white" : "bg-gray-200 text-gray-900"
                : isDark 
                  ? "text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100" 
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            )}
            onClick={() => onSelectCategory(category)}
          >
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </Button>
        ))}
      </CardContent>

      <CardHeader className={`sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 p-4 border-t border-b ${isDark ? "bg-neutral-900 border-neutral-800" : "bg-white border-gray-200"}`}>
        <CardTitle className={`text-lg font-semibold ${isDark ? "text-neutral-100" : "text-gray-900"}`}>Notes</CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-1">
        {filteredNotes.length > 0 ? (
          filteredNotes.map((note) => (
            <Button
              key={note.id}
              variant="ghost"
              className={`w-full justify-start text-left h-auto whitespace-normal px-3 py-2 text-sm rounded-md ${isDark 
                ? "text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100" 
                : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"}`}
              onClick={() => onSelectNote(note.id)}
            >
              {note.title}
            </Button>
          ))
        ) : (
          <p className={`text-sm px-3 py-2 ${isDark ? "text-neutral-500" : "text-gray-500"}`}>
            {searchQuery.trim() 
              ? "No notes match your search." 
              : "No notes in this category."}
          </p>
        )}
      </CardContent>
    </Card>
  );
} 