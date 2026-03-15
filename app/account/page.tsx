"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/context/auth-context"
import { SettingsContent } from "@/components/settings-content"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { LogOut, Trash2, ChevronLeft } from "lucide-react"
import { AppSidebar } from "@/components/notes/app-sidebar"
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export default function AccountPage() {
  const router = useRouter()
  const supabase = createClient()
  const {
    session,
    user,
    isLoading: authIsLoading,
    error: authError,
    signOut,
  } = useAuth()
  const [error, setError] = useState<string | null>(authError || null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [activeSection, setActiveSection] = useState<
    "preferences" | "danger"
  >("preferences")

  useEffect(() => {
    if (!authIsLoading && !session) {
      router.push("/")
    }
  }, [session, authIsLoading, router])

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true)
      await signOut()
      router.push("/")
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsSigningOut(false)
    }
  }

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true)
      const { error } = await supabase.rpc("delete_user_account")
      if (error) throw error
      await supabase.auth.signOut()
      router.push("/")
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsDeleting(false)
    }
  }

  if (authIsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-5 h-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
      </div>
    )
  }

  if (!user) return null

  const initial = (user.email?.charAt(0) ?? "U").toUpperCase()
  const username = user.email?.split("@")[0] ?? "user"
  const joined = new Date(user.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  const navItems = [
    { id: "preferences" as const, label: "Preferences" },
    { id: "danger" as const, label: "Danger zone" },
  ]

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 backdrop-blur-sm px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm font-medium text-muted-foreground">
            Account
          </span>
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="text-muted-foreground hover:text-foreground gap-2 text-xs"
            >
              <LogOut className="h-3.5 w-3.5" />
              {isSigningOut ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl px-6 py-12 space-y-12">
          {/* Profile card */}
          <section className="flex items-center gap-5">
            <div className="h-14 w-14 rounded-full bg-foreground text-background flex items-center justify-center text-lg font-semibold shrink-0">
              {initial}
            </div>
            <div className="min-w-0 space-y-0.5">
              <h1 className="text-xl font-semibold tracking-tight truncate">
                {username}
              </h1>
              <p className="text-sm text-muted-foreground truncate">
                {user.email}
              </p>
              <p className="text-xs text-muted-foreground/60">
                Joined {joined}
              </p>
            </div>
          </section>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Section nav */}
          <nav className="flex gap-1 border-b">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                  activeSection === item.id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground/70"
                }`}
              >
                {item.label}
                {activeSection === item.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-px bg-foreground" />
                )}
              </button>
            ))}
          </nav>

          {/* Preferences */}
          {activeSection === "preferences" && (
            <section className="space-y-1">
              <SettingsContent />
            </section>
          )}

          {/* Danger zone */}
          {activeSection === "danger" && (
            <section className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-destructive">
                  Delete account
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Permanently remove your account and all associated data.
                  This action is irreversible.
                </p>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground gap-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently erase all your decks, notes,
                      study progress, and settings. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      disabled={isDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? "Deleting…" : "Yes, delete everything"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </section>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
