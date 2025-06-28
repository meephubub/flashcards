import { Button } from "@/components/ui/button";
import Logo from "./logo";
import NavigationSheet from "./navigation-sheet";
import Link from "next/link";

const Navbar04Page = () => {
  return (
    <nav className="fixed top-6 left-4 right-4 z-50 bg-white/95 backdrop-blur-md border border-gray-200 dark:bg-black/95 dark:border-gray-800 rounded-2xl shadow-lg max-w-7xl mx-auto">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Logo />
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login" passHref legacyBehavior>
              <Button
                asChild
                variant="ghost"
                className="hidden sm:inline-flex text-gray-700 hover:text-black hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800 transition-colors"
              >
                <span>Sign In</span>
              </Button>
            </Link>
            <Link href="/signup" passHref legacyBehavior>
              <Button 
                asChild 
                className="bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 transition-colors"
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
