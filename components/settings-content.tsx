"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Save, RotateCcw, Download, AlertTriangle } from "lucide-react"
import { useSettings } from "@/context/settings-context"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { useDecks } from "@/context/deck-context"
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

export function SettingsContent() {
  const { settings, loading, updateSettings, updateStudySettings, resetSettings } = useSettings()
  const { decks } = useDecks()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // Create local state for settings
  const [localSettings, setLocalSettings] = useState({
    theme: settings.theme,
    enableAnimations: settings.enableAnimations,
    enableSounds: settings.enableSounds,
    enableTTS: settings.enableTTS,
    studySettings: {
      cardsPerSession: settings.studySettings.cardsPerSession,
      showProgressBar: settings.studySettings.showProgressBar,
      enableSpacedRepetition: settings.studySettings.enableSpacedRepetition,
      autoFlip: settings.studySettings.autoFlip,
      autoFlipDelay: settings.studySettings.autoFlipDelay,
      languageSimilarityThreshold: settings.studySettings.languageSimilarityThreshold ?? 0.75, // Ensure default if undefined
    },
  })

  // Update local state when settings are loaded
  useState(() => {
    if (!loading) {
      setLocalSettings(settings)
    }
  })

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true)
      await updateSettings(localSettings)
      toast({
        title: "Settings saved",
        description: "Your settings have been updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetSettings = async () => {
    try {
      setIsResetting(true)
      await resetSettings()
      setLocalSettings(settings)
      toast({
        title: "Settings reset",
        description: "Your settings have been reset to default values.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsResetting(false)
    }
  }

  const exportAllData = () => {
    try {
      const dataToExport = {
        decks,
        settings,
      }

      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `flashcards-backup-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Export successful",
        description: "Your data has been exported successfully.",
      })
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>

      <Tabs defaultValue="appearance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="study">Study</TabsTrigger>
          <TabsTrigger value="data">Data Management</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize how the application looks and feels</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select
                  value={localSettings.theme}
                  onValueChange={(value) =>
                    setLocalSettings({ ...localSettings, theme: value as "light" | "dark" | "system" })
                  }
                >
                  <SelectTrigger id="theme">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="animations">Animations</Label>
                  <p className="text-sm text-muted-foreground">Enable animations throughout the application</p>
                </div>
                <Switch
                  id="animations"
                  checked={localSettings.enableAnimations}
                  onCheckedChange={(checked) => setLocalSettings({ ...localSettings, enableAnimations: checked })}
                />
              </div>

              <div className="flex items-center justify-between space-y-1">
                <div className="space-y-0.5">
                  <Label htmlFor="enableSounds">Sound Effects</Label>
                  <p className="text-muted-foreground text-xs">
                    Enable or disable sound effects for card interactions
                  </p>
                </div>
                <Switch
                  id="enableSounds"
                  checked={localSettings.enableSounds}
                  onCheckedChange={(value) =>
                    setLocalSettings({ ...localSettings, enableSounds: value })
                  }
                />
              </div>

              <div className="flex items-center justify-between space-y-1">
                <div className="space-y-0.5">
                  <Label htmlFor="enableTTS">Text-to-Speech</Label>
                  <p className="text-muted-foreground text-xs">
                    Enable or disable text-to-speech for language cards
                  </p>
                </div>
                <Switch
                  id="enableTTS"
                  checked={localSettings.enableTTS}
                  onCheckedChange={(value) =>
                    setLocalSettings({ ...localSettings, enableTTS: value })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="study" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Study Settings</CardTitle>
              <CardDescription>Customize your study experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cards-per-session">
                  Cards Per Session: {localSettings.studySettings.cardsPerSession}
                </Label>
                <Slider
                  id="cards-per-session"
                  min={5}
                  max={50}
                  step={5}
                  value={[localSettings.studySettings.cardsPerSession]}
                  onValueChange={(value) =>
                    setLocalSettings({
                      ...localSettings,
                      studySettings: {
                        ...localSettings.studySettings,
                        cardsPerSession: value[0],
                      },
                    })
                  }
                  className="py-4"
                />
                <p className="text-sm text-muted-foreground">Maximum number of cards to study in a single session</p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="progress-bar">Progress Bar</Label>
                  <p className="text-sm text-muted-foreground">Show progress bar during study sessions</p>
                </div>
                <Switch
                  id="progress-bar"
                  checked={localSettings.studySettings.showProgressBar}
                  onCheckedChange={(checked) =>
                    setLocalSettings({
                      ...localSettings,
                      studySettings: {
                        ...localSettings.studySettings,
                        showProgressBar: checked,
                      },
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="spaced-repetition">Spaced Repetition</Label>
                  <p className="text-sm text-muted-foreground">Use spaced repetition algorithm to optimize learning</p>
                </div>
                <Switch
                  id="spaced-repetition"
                  checked={localSettings.studySettings.enableSpacedRepetition}
                  onCheckedChange={(checked) =>
                    setLocalSettings({
                      ...localSettings,
                      studySettings: {
                        ...localSettings.studySettings,
                        enableSpacedRepetition: checked,
                      },
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-flip">Auto Flip</Label>
                  <p className="text-sm text-muted-foreground">Automatically flip cards after a delay</p>
                </div>
                <Switch
                  id="auto-flip"
                  checked={localSettings.studySettings.autoFlip}
                  onCheckedChange={(checked) =>
                    setLocalSettings({
                      ...localSettings,
                      studySettings: {
                        ...localSettings.studySettings,
                        autoFlip: checked,
                      },
                    })
                  }
                />
              </div>

              {localSettings.studySettings.autoFlip && (
                <div className="space-y-2">
                  <Label htmlFor="auto-flip-delay">
                    Auto Flip Delay: {localSettings.studySettings.autoFlipDelay} seconds
                  </Label>
                  <Slider
                    id="auto-flip-delay"
                    min={1}
                    max={10}
                    step={1}
                    value={[localSettings.studySettings.autoFlipDelay]}
                    onValueChange={(value) =>
                      setLocalSettings({
                        ...localSettings,
                        studySettings: {
                          ...localSettings.studySettings,
                          autoFlipDelay: value[0],
                        },
                      })
                    }
                    className="py-4"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="similarity-threshold">Language Study Similarity Threshold: {Math.round((localSettings.studySettings.languageSimilarityThreshold ?? 0.75) * 100)}%</Label>
                <p className="text-xs text-muted-foreground">
                  Set the minimum text similarity required for an answer to be considered correct in Language Study mode.
                </p>
                <Slider
                  id="similarity-threshold"
                  min={0}
                  max={1}
                  step={0.01}
                  value={[(localSettings.studySettings.languageSimilarityThreshold ?? 0.75)]}
                  onValueChange={(value) =>
                    setLocalSettings({
                      ...localSettings,
                      studySettings: {
                        ...localSettings.studySettings,
                        languageSimilarityThreshold: value[0],
                      },
                    })
                  }
                  className="py-4"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>Export, import, or reset your data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">Export All Data</h3>
                  <p className="text-sm text-muted-foreground">
                    Export all your decks and settings as a JSON file for backup
                  </p>
                  <Button variant="outline" className="w-fit" onClick={exportAllData}>
                    <Download className="mr-2 h-4 w-4" />
                    Export Data
                  </Button>
                </div>

                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">Reset Settings</h3>
                  <p className="text-sm text-muted-foreground">
                    Reset all settings to their default values. This will not affect your flashcard decks.
                  </p>
                  <Button variant="outline" className="w-fit" onClick={handleResetSettings} disabled={isResetting}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {isResetting ? "Resetting..." : "Reset Settings"}
                  </Button>
                </div>

                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium text-destructive">Danger Zone</h3>
                  <p className="text-sm text-muted-foreground">
                    These actions are destructive and cannot be undone. Please proceed with caution.
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-fit">
                        <AlertTriangle className="mr-2 h-4 w-4" />
                        Reset All Data
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete all your flashcard decks and reset
                          all settings to their default values.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Reset All Data
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" asChild>
          <Link href="/">Cancel</Link>
        </Button>
        <Button onClick={handleSaveSettings} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  )
}
