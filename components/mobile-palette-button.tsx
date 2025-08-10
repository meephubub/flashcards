"use client"

import { Search } from "lucide-react"
import React from "react"

export default function MobilePaletteButton() {
  // Only show on small screens; fixed top-right
  return (
    <button
      type="button"
      aria-label="Open search"
      className="md:hidden fixed top-3 right-3 z-50 inline-flex items-center justify-center h-11 w-11 rounded-full border border-black/10 dark:border-white/10 bg-white/90 dark:bg-neutral-800/90 backdrop-blur text-gray-800 dark:text-gray-100 shadow-sm hover:bg-white dark:hover:bg-neutral-800"
      onClick={() => {
        // Dispatch a custom event for the ActionSearchBar to listen for
        window.dispatchEvent(new Event('open-action-search'))
      }}
    >
      <Search className="h-5 w-5" />
    </button>
  )
}
