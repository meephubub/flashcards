"use client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface SpeechToTextModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SpeechToTextModal({ isOpen, onClose }: SpeechToTextModalProps) {
 return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full h-full md:h-auto md:w-[400px]">
        <SheetHeader>
          <SheetTitle>Speech to Text</SheetTitle>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
}