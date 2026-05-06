"use client";

import { AppSidebar } from "@/components/notes/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Link } from "next-view-transitions";
import { Mountain } from "lucide-react";
import Image from "next/image";

export default function IslandsPage() {
  // Dummy data for now - will be replaced with real data later
  const sessionsThisWeek = 2;
  const hoursThisWeek = 67;

  return (
    <div className="flex h-screen bg-white dark:bg-black">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-100 dark:border-zinc-900 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink asChild>
                      <Link href="/">Decks</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="flex items-center gap-2">
                      <Mountain className="h-4 w-4" />
                      Islands
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] p-8">
              {/* Study Stats Text */}
              <div className="text-center mb-8">
                <p className="text-lg text-gray-700 dark:text-gray-300">
                  You&apos;ve logged <span className="font-semibold text-gray-900 dark:text-gray-100">{sessionsThisWeek} sessions</span> totalling <span className="font-semibold text-gray-900 dark:text-gray-100">{hoursThisWeek} hours</span>
                </p>
              </div>

              {/* Isometric Islands */}
              <div className="relative w-full max-w-4xl">
                <div className="flex flex-col items-center gap-0">
                  {/* Island 1 - Left side (higher up) */}
                  <div className="relative -mb-16 sm:-mb-24 md:-mb-32 z-10 self-start ml-[10%] sm:ml-[15%] md:ml-[20%]">
                    <Image
                      src="/islands/island-1.png"
                      alt="Island 1"
                      width={400}
                      height={300}
                      className="w-48 h-auto sm:w-64 md:w-80 lg:w-96 drop-shadow-2xl"
                      priority
                    />
                  </div>

                  {/* Island 2 - Right side (lower, appears in front) */}
                  <div className="relative self-end mr-[5%] sm:mr-[10%] md:mr-[15%]">
                    <Image
                      src="/islands/island-2.png"
                      alt="Island 2"
                      width={600}
                      height={450}
                      className="w-64 h-auto sm:w-80 md:w-96 lg:w-[500px] drop-shadow-2xl"
                      priority
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
