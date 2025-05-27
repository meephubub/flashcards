// components/image-search-dialog.tsx
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"; // Assuming these are correctly pathed from shadcn/ui
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Assuming Alert is setup in ui
import { Loader2 } from "lucide-react";

interface ImageSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  images: string[];
  isLoading: boolean;
  error: string | null;
  onImageSelect: (imageUrl: string) => void;
}

export const ImageSearchDialog: React.FC<ImageSearchDialogProps> = ({
  isOpen,
  onClose,
  query,
  images,
  isLoading,
  error,
  onImageSelect,
}) => {
  // No need to check for isOpen here, Dialog handles it.
  // if (!isOpen) return null; 

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] bg-neutral-900 border-neutral-800 text-neutral-100">
        <DialogHeader>
          <DialogTitle>Select Image for "{query}"</DialogTitle>
          <DialogDescription>
            Click an image to insert it into your note. Showing up to 10 images.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[400px] w-full rounded-md border border-neutral-700 p-4 my-4">
          {isLoading && (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
              <p className="ml-2">Loading images...</p>
            </div>
          )}
          {error && (
            <Alert variant="destructive" className="bg-red-900/40 border-red-700/60 text-red-300">
              {/*<AlertCircle className="h-4 w-4" /> You might need an icon for Alert if not default */}
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!isLoading && !error && images.length === 0 && (
            <p className="text-center text-neutral-400 py-10">No images found for "{query}". Try a different search term.</p>
          )}
          {!isLoading && !error && images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {images.map((src, index) => (
                <button
                  key={index}
                  onClick={() => onImageSelect(src)}
                  className="aspect-square overflow-hidden rounded-md border border-neutral-700 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-900 transition-all group bg-neutral-800"
                >
                  <img
                    src={src}
                    alt={`Search result ${index + 1} for ${query}`}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200" // object-contain to see whole image
                    loading="lazy" // Lazy load images
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.parentElement?.style.setProperty('display', 'none'); // Hide button if image fails
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="bg-neutral-800 border-neutral-700 hover:bg-neutral-700">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
