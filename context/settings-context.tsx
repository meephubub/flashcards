"use client"

import { createContext, useState, useContext, useEffect, type ReactNode } from "react"
import type { AppSettings, StudySettings } from "@/lib/settings"
import { getSettings, saveSettings, resetSettings as resetSettingsApi } from "@/lib/settings"
import { supabase } from "@/lib/supabase"

interface SettingsContextType {
  settings: AppSettings
  loading: boolean
  updateSettings: (settings: AppSettings) => Promise<void>
  updateStudySettings: (studySettings: StudySettings) => Promise<void>
  resetSettings: () => Promise<void>
}

const defaultSettings: AppSettings = {
  theme: "system",
  enableAnimations: true,
  enableSounds: false,
  enableTTS: false,
  studySettings: {
    cardsPerSession: 20,
    showProgressBar: true,
    enableSpacedRepetition: true,
    autoFlip: false,
    autoFlipDelay: 5,
    languageSimilarityThreshold: 0.75, // Default value
  },
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)

  // Fetch settings on initial load
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true)
        // Load settings directly using the browser Supabase client
        const loaded = await getSettings(supabase)
        setSettings(loaded)
      } catch (error) {
        console.error("Error fetching settings:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  // Update theme when settings change
  useEffect(() => {
    if (!loading) {
      const { theme } = settings
      if (theme === "system") {
        document.documentElement.classList.remove("light", "dark")
        document.documentElement.setAttribute("data-theme", "system")
      } else {
        document.documentElement.classList.remove("light", "dark")
        document.documentElement.classList.add(theme)
        document.documentElement.setAttribute("data-theme", theme)
      }
    }
  }, [settings, loading])

  const updateSettings = async (newSettings: AppSettings) => {
    try {
      // Update settings directly using the browser Supabase client
      await saveSettings(supabase, newSettings)
      setSettings(newSettings)
    } catch (error) {
      console.error("Error updating settings:", error)
      throw error
    }
  }

  const updateStudySettings = async (newStudySettings: StudySettings) => {
    const updatedSettings = {
      ...settings,
      studySettings: newStudySettings,
    }

    await updateSettings(updatedSettings)
  }

  const resetSettings = async () => {
    try {
      // Reset settings directly using the browser Supabase client
      const defaults = await resetSettingsApi(supabase)
      setSettings(defaults)
    } catch (error) {
      console.error("Error resetting settings:", error)
      throw error
    }
  }

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        updateSettings,
        updateStudySettings,
        resetSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    // Return default values for SSR compatibility
    return {
      settings: {
        theme: "system",
        studySettings: {
          autoPlay: false,
          showAnswer: false,
          shuffleCards: false,
          studyMode: "spaced-repetition",
        },
      },
      loading: true,
      updateSettings: async () => {},
      updateStudySettings: async () => {},
      resetSettings: async () => {},
    }
  }
  return context
}
