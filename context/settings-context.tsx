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
    enableSpacedRepetition: false,
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
        
        // First try to get settings from the API
        try {
          const response = await fetch("/api/settings")
          if (response.ok) {
            const data = await response.json()
            setSettings(data)
            return
          }
        } catch (apiError) {
          console.warn("API route not available, falling back to direct function call:", apiError)
        }
        
        // Fallback: Get settings directly using the supabase client
        const settings = await getSettings(supabase)
        setSettings(settings)
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
      // First try to update settings via the API
      try {
        const response = await fetch("/api/settings", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newSettings),
        })

        if (response.ok) {
          setSettings(newSettings)
          return
        }
      } catch (apiError) {
        console.warn("API route not available, falling back to direct function call:", apiError)
      }
      
      // Fallback: Update settings directly using the supabase client
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
      // First try to reset settings via the API
      try {
        const response = await fetch("/api/settings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "reset" }),
        })

        if (response.ok) {
          const defaultSettings = await response.json()
          setSettings(defaultSettings)
          return
        }
      } catch (apiError) {
        console.warn("API route not available, falling back to direct function call:", apiError)
      }
      
      // Fallback: Reset settings directly using the supabase client
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
    throw new Error("useSettings must be used within a SettingsProvider")
  }
  return context
}
