"use client"

import React, { useState } from "react"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/context/auth-context"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/notes/app-sidebar"

export default function AccountPage() {
  const { user, isLoading, error, signOut } = useAuth()
  const supabase = createClient()

  // Editable profile fields (monochrome, minimal)
  const [fullName, setFullName] = useState<string>(() => String(user?.user_metadata?.full_name ?? ""))
  const [updatingProfile, setUpdatingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<string | null>(null)

  const [password, setPassword] = useState("")
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null)

  const email = user?.email || ""
  const userId = user?.id || ""
  const created = user?.created_at ? new Date(user.created_at).toLocaleString() : ""

  const canSubmitProfile = fullName !== String(user?.user_metadata?.full_name ?? "")
  const canSubmitPassword = password.trim().length >= 8

  const onUpdateProfile = async () => {
    if (!user) return
    if (!canSubmitProfile) return
    setUpdatingProfile(true)
    setProfileMsg(null)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName || null },
      })
      if (error) throw error
      setProfileMsg("Profile updated")
    } catch (e: any) {
      setProfileMsg(e?.message || "Failed to update profile")
    } finally {
      setUpdatingProfile(false)
    }
  }

  const onUpdatePassword = async () => {
    if (!user) return
    if (!canSubmitPassword) return
    setUpdatingPassword(true)
    setPasswordMsg(null)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setPassword("")
      setPasswordMsg("Password updated")
    } catch (e: any) {
      setPasswordMsg(e?.message || "Failed to update password")
    } finally {
      setUpdatingPassword(false)
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">Settings</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Account</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="bg-background min-h-[100vh] flex-1 rounded-xl md:min-h-min p-6 md:p-10">
            <div className="mx-auto max-w-3xl">
              {/* Title */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-2 text-neutral-900 dark:text-neutral-100">Account</h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Manage your profile and security settings.</p>
              </div>

              {/* Profile Card */}
              <section className="mb-8 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-950">
                <div className="p-6 md:p-8">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Profile</h2>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Basic information associated with your account.</p>

                  <div className="mt-6 grid gap-4">
                    <div>
                      <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1">Email</label>
                      <Input value={email} disabled className="bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300" />
                    </div>
                    <div>
                      <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1">Full name</label>
                      <Input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Your name"
                        className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">User ID: {userId}</div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">Created: {created}</div>
                    </div>
                    {profileMsg && (
                      <div className="text-sm text-neutral-600 dark:text-neutral-300">{profileMsg}</div>
                    )}
                    <div className="flex justify-end">
                      <Button
                        onClick={onUpdateProfile}
                        disabled={!canSubmitProfile || updatingProfile}
                        className="bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                      >
                        {updatingProfile ? "Saving…" : "Save changes"}
                      </Button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Security Card */}
              <section className="mb-8 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-950">
                <div className="p-6 md:p-8">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Security</h2>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Update your password.</p>

                  <div className="mt-6 grid gap-4">
                    <div>
                      <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1">New password</label>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100"
                      />
                    </div>
                    {passwordMsg && (
                      <div className="text-sm text-neutral-600 dark:text-neutral-300">{passwordMsg}</div>
                    )}
                    <div className="flex justify-end">
                      <Button
                        onClick={onUpdatePassword}
                        disabled={!canSubmitPassword || updatingPassword}
                        className="bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                      >
                        {updatingPassword ? "Updating…" : "Update password"}
                      </Button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Danger Zone */}
              <section className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-950">
                <div className="p-6 md:p-8">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Sign out</h2>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">End your current session on this device.</p>
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      onClick={() => void signOut()}
                      className="border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                    >
                      Sign out
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
