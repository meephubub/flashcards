"use client"

import React, { useEffect, useState } from "react"
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
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { useAuth } from "@/context/auth-context"
import { useSettings } from "@/context/settings-context"
import type { StudySettings } from "@/lib/settings"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/notes/app-sidebar"

export default function AccountPage() {
  const { user, isLoading, error, signOut } = useAuth()
  const { settings, updateStudySettings } = useSettings()
  const supabase = createClient()

  const [localStudy, setLocalStudy] = useState<StudySettings | null>(null)

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

  useEffect(() => {
    const currentStudy = settings?.studySettings as StudySettings | undefined
    if (!currentStudy) return

    try {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem("accountStudyPrefs") : null
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<StudySettings>
        const merged: StudySettings = {
          ...currentStudy,
          ...parsed,
        }
        setLocalStudy(merged)
      } else {
        setLocalStudy(currentStudy)
      }
    } catch {
      setLocalStudy(currentStudy)
    }
  }, [settings])

  const persistStudySettings = (updated: StudySettings) => {
    setLocalStudy(updated)
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("accountStudyPrefs", JSON.stringify({
          enableSpacedRepetition: updated.enableSpacedRepetition,
          cardsPerSession: updated.cardsPerSession,
          languageSimilarityThreshold: updated.languageSimilarityThreshold,
        }))
      } catch {
        // ignore localStorage errors
      }
    }
    void updateStudySettings(updated)
  }

  // Wallet state
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [tokenSymbol, setTokenSymbol] = useState<string>("")
  const [tokenBalance, setTokenBalance] = useState<string>("")
  const [walletLoading, setWalletLoading] = useState<boolean>(false)
  const [walletActionLoading, setWalletActionLoading] = useState<boolean>(false)

  const loadWalletAndBalance = async () => {
    if (!userId) return
    setWalletLoading(true)
    try {
      // Get custodial wallet address
      const { data: wallet, error: wErr } = await supabase
        .from("wallets")
        .select("address")
        .eq("user_id", userId)
        .maybeSingle()
      if (wErr) throw wErr
      const address = wallet?.address || ""
      setWalletAddress(address)

      if (address) {
        const res = await fetch(`/api/balance?address=${encodeURIComponent(address)}`, { cache: "no-store" })
        if (res.ok) {
          const json = await res.json()
          setTokenBalance(String(json.balance ?? ""))
          setTokenSymbol(String(json.symbol ?? ""))
        } else {
          setTokenBalance("")
          setTokenSymbol("")
        }
      } else {
        setTokenBalance("")
        setTokenSymbol("")
      }
    } catch (e) {
      // Silent fail to avoid disrupting account page
    } finally {
      setWalletLoading(false)
    }
  }

  useEffect(() => {
    void loadWalletAndBalance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const createWalletNow = async () => {
    setWalletActionLoading(true)
    try {
      const res = await fetch("/api/wallet/create", { method: "POST" })
      if (!res.ok) throw new Error("Create wallet failed")
      await loadWalletAndBalance()
    } catch (e) {
      // no-op
    } finally {
      setWalletActionLoading(false)
    }
  }

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
        <header className="flex h-12 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-3">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb className="text-xs md:text-sm">
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

        <div className="flex flex-1 flex-col gap-3 p-3 pt-0">
          <div className="bg-background flex-1 rounded-xl p-4 md:p-6">
            <div className="mx-auto max-w-3xl">
              {/* Title */}
              <div className="mb-3">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight mb-1.5 text-neutral-900 dark:text-neutral-100">Account</h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Manage your profile and security settings.</p>
              </div>

              {/* Profile Card */}
              <section className="mb-5 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-950">
                <div className="p-4 md:p-5">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Profile</h2>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Basic information associated with your account.</p>

                  <div className="mt-5 grid gap-3.5">
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

              <section className="mb-6 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-950">
                <div className="p-4 md:p-5">
                  <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Study preferences</h2>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">Control spaced repetition and language study behavior for your account.</p>

                    <div className="mt-2 flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label htmlFor="account-spaced-repetition" className="text-sm text-neutral-700 dark:text-neutral-300">Enable spaced repetition</Label>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">When enabled, study sessions use FSRS scheduling instead of simple review.</p>
                      </div>
                      <Switch
                        id="account-spaced-repetition"
                        checked={Boolean((localStudy ?? (settings?.studySettings as StudySettings | undefined))?.enableSpacedRepetition)}
                        onCheckedChange={(checked) => {
                          const base = (localStudy ?? (settings?.studySettings as StudySettings | undefined))
                          if (!base) return
                          const updated: StudySettings = {
                            ...base,
                            enableSpacedRepetition: checked,
                          }
                          persistStudySettings(updated)
                        }}
                      />
                    </div>

                    <div className="mt-4 space-y-2">
                      <Label htmlFor="account-cards-per-session" className="text-sm text-neutral-700 dark:text-neutral-300">
                        Cards per session
                      </Label>
                      <div className="flex items-center gap-3">
                        <Slider
                          id="account-cards-per-session"
                          min={5}
                          max={50}
                          step={5}
                          value={[ (localStudy ?? (settings?.studySettings as StudySettings | undefined))?.cardsPerSession ?? 20 ]}
                          onValueChange={(value) => {
                            const base = (localStudy ?? (settings?.studySettings as StudySettings | undefined))
                            if (!base) return
                            const updated: StudySettings = {
                              ...base,
                              cardsPerSession: value[0],
                            }
                            persistStudySettings(updated)
                          }}
                          className="flex-1"
                        />
                        <div className="w-12 text-right text-sm text-neutral-700 dark:text-neutral-300">
                          {(localStudy ?? (settings?.studySettings as StudySettings | undefined))?.cardsPerSession ?? 20}
                        </div>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Maximum number of cards to study in a single session.</p>
                    </div>

                    <div className="mt-4 space-y-2">
                      <Label htmlFor="account-similarity-threshold" className="text-sm text-neutral-700 dark:text-neutral-300">
                        Language study similarity threshold
                      </Label>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Set how similar a typed answer must be to be counted as correct when using language study.
                      </p>
                      <div className="flex items-center gap-3">
                        <Slider
                          id="account-similarity-threshold"
                          min={0}
                          max={1}
                          step={0.01}
                          value={[ (localStudy ?? (settings?.studySettings as StudySettings | undefined))?.languageSimilarityThreshold ?? 0.75 ]}
                          onValueChange={(value) => {
                            const base = (localStudy ?? (settings?.studySettings as StudySettings | undefined))
                            if (!base) return
                            const updated: StudySettings = {
                              ...base,
                              languageSimilarityThreshold: value[0],
                            }
                            persistStudySettings(updated)
                          }}
                          className="flex-1"
                        />
                        <div className="w-12 text-right text-sm text-neutral-700 dark:text-neutral-300">
                          {Math.round(((localStudy ?? (settings?.studySettings as StudySettings | undefined))?.languageSimilarityThreshold ?? 0.75) * 100)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Wallet Card */}
              <section className="mb-6 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-950">
                <div className="p-4 md:p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Wallet</h2>
                      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Your custodial wallet details.</p>
                    </div>
                    <Button onClick={() => void loadWalletAndBalance()} disabled={walletLoading} className="bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white">
                      {walletLoading ? "Refreshing…" : "Refresh"}
                    </Button>
                  </div>

                  <div className="mt-5 grid gap-3.5">
                    <div>
                      <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1">Wallet address</label>
                      <Input value={walletAddress || "Not created yet"} readOnly className="bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300" />
                      {!walletAddress && (
                        <div className="mt-2.5">
                          <Button onClick={() => void createWalletNow()} disabled={walletActionLoading} className="bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white">
                            {walletActionLoading ? "Creating…" : "Create wallet"}
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1">Balance</label>
                        <Input value={tokenBalance ? `${tokenBalance}` : ""} readOnly className="bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300" />
                      </div>
                      <div>
                        <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1">Symbol</label>
                        <Input value={tokenSymbol} readOnly className="bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300" />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Security Card */}
              <section className="mb-6 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-950">
                <div className="p-4 md:p-5">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Security</h2>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Update your password.</p>

                  <div className="mt-5 grid gap-3.5">
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
                <div className="p-4 md:p-5">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Sign out</h2>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">End your current session on this device.</p>
                  <div className="mt-3">
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
