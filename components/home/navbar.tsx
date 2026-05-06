"use client"

import { Button } from "@/components/ui/button";
import Logo from "./logo";
import NavigationSheet from "./navigation-sheet";
import Link from "next/link";

const Navbar04Page = () => {
  return (
    <nav className="fixed top-4 left-2 right-2 z-50 
       bg-white/50 backdrop-blur-lg 
       border border-white-200 
       dark:bg-black/90 dark:border-white-800 
       rounded-3xl shadow-xl 
       max-w-6xl mx-auto"
    >
      <div className="px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Logo />
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/home"
              className="text-black-700 hover:text-black dark:text-black-300 dark:hover:text-white transition-colors rounded-full px-3 py-1 text-sm"
            >
              Home
            </Link>
            <Link
              href="/home/about-us"
              className="text-black-700 hover:text-black dark:text-black-300 dark:hover:text-white transition-colors rounded-full px-3 py-1 text-sm"
            >
              About
            </Link>
            <Link
              href="/home/pricing"
              className="text-black-700 hover:text-black dark:text-black-300 dark:hover:text-white transition-colors rounded-full px-3 py-1 text-sm"
            >
              Pricing
            </Link>
            <Link
              href="/notes"
              className="text-black-700 hover:text-black dark:text-black-300 dark:hover:text-white transition-colors rounded-full px-3 py-1 text-sm"
            >
              Notes
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login">
              {/* @next-codemod-error This Link previously used the now removed `legacyBehavior` prop, and has a child that might not be an anchor. The codemod bailed out of lifting the child props to the Link. Check that the child component does not render an anchor, and potentially move the props manually to Link. */
              }
              <Button
                asChild
                variant="ghost"
                className="hidden sm:inline-flex text-black-700 hover:text-black hover:bg-gray-100 dark:text-black-300 dark:hover:text-white dark:hover:bg-gray-800 transition-colors rounded-full px-4 py-1 text-sm"
              >
                <span>Sign In</span>
              </Button>
            </Link>
            <Link href="/signup">
              {/* @next-codemod-error This Link previously used the now removed `legacyBehavior` prop, and has a child that might not be an anchor. The codemod bailed out of lifting the child props to the Link. Check that the child component does not render an anchor, and potentially move the props manually to Link. */
              }
              <Button
                asChild
                className="bg-black text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-black-200 transition-colors rounded-full px-5 py-1.5 text-sm shadow-md"
              >
                <span>Get Started</span>
              </Button>
            </Link>

            {/* Mobile Menu */}
            <div className="md:hidden">
              <NavigationSheet />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar04Page;