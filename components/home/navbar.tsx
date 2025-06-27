import { Button } from "@/components/ui/button";
import Logo from "./logo";
import NavigationSheet from "./navigation-sheet";
import Link from "next/link";

const Navbar04Page = () => {
  return (
    <div className="min-h-screen bg-muted">
      <nav className="fixed top-6 inset-x-4 h-16 bg-background/60 border dark:border-slate-700/70 max-w-screen-xl mx-auto rounded-full backdrop-blur-md shadow-lg">
        <div className="h-full flex items-center justify-between mx-auto px-4">
          <Logo />

          {/* Removed NavMenu for frosted glass minimalist look */}

          <div className="flex items-center gap-3">
            <Link href="/login" passHref legacyBehavior>
              <Button
                asChild
                variant="outline"
                className="hidden sm:inline-flex rounded-full"
              >
                <span>Sign In</span>
              </Button>
            </Link>
            <Link href="/signup" passHref legacyBehavior>
              <Button asChild className="rounded-full">
                <span>Get Started</span>
              </Button>
            </Link>

            {/* Mobile Menu */}
            <div className="md:hidden">
              <NavigationSheet />
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Navbar04Page;
