'use client';
import * as React from 'react';
import Link from 'next/link';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';

export const NavigationSheet = () => {
  const [open, setOpen] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button aria-label="Open menu" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <Menu className="w-6 h-6 text-gray-700 dark:text-gray-200" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-64 bg-background">
        <nav className="flex flex-col gap-4 p-6">
          <Link href="/" className="text-lg font-medium text-gray-700 dark:text-gray-200 hover:text-primary transition-colors" onClick={() => setOpen(false)}>Home</Link>
          <Link href="/decks" className="text-lg font-medium text-gray-700 dark:text-gray-200 hover:text-primary transition-colors" onClick={() => setOpen(false)}>Decks</Link>
          <Link href="/notes" className="text-lg font-medium text-gray-700 dark:text-gray-200 hover:text-primary transition-colors" onClick={() => setOpen(false)}>Notes</Link>
          <Link href="/settings" className="text-lg font-medium text-gray-700 dark:text-gray-200 hover:text-primary transition-colors" onClick={() => setOpen(false)}>Settings</Link>
          <div className="mt-8 flex flex-col gap-2">
            <Link href="/login" className="text-lg font-medium text-primary underline hover:opacity-80" onClick={() => setOpen(false)}>Sign In</Link>
            <Link href="/signup" className="text-lg font-medium text-primary underline hover:opacity-80" onClick={() => setOpen(false)}>Get Started</Link>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
};

export default NavigationSheet; 