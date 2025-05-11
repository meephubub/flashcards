import { supabase } from "./supabase"

export interface StudySettings {
  cardsPerSession: number
  showProgressBar: boolean
  enableSpacedRepetition: boolean
  autoFlip: boolean
  autoFlipDelay: number // in seconds
}

export interface AppSettings {
  theme: "light" | "dark" | "system"
  enableAnimations: boolean
  enableSounds: boolean
  studySettings: StudySettings
}

// Default settings
const defaultSettings: AppSettings = {
  theme: "system",
  enableAnimations: true,
  enableSounds: false,
  studySettings: {
    cardsPerSession: 20,
    showProgressBar: true,
    enableSpacedRepetition: false,
    autoFlip: false,
    autoFlipDelay: 5,
  },
}

// Get settings
export async function getSettings(): Promise<AppSettings> {
  try {
    const { data, error } = await supabase
      .from("settings")
      .select("*")
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        // No settings found, create default settings
        const { data: newSettings, error: createError } = await supabase
          .from("settings")
          .insert([defaultSettings])
          .select()
          .single()

        if (createError) {
          console.error("Error creating default settings:", createError)
          return defaultSettings
        }

        return newSettings
      }

      console.error("Error fetching settings:", error)
      return defaultSettings
    }

    return data
  } catch (error) {
    console.error("Error in getSettings:", error)
    return defaultSettings
  }
}

// Save settings
export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    const { error } = await supabase
      .from("settings")
      .upsert([settings])
      .select()

    if (error) {
      console.error("Error saving settings:", error)
      throw new Error("Failed to save settings")
    }
  } catch (error) {
    console.error("Error in saveSettings:", error)
    throw new Error("Failed to save settings")
  }
}

// Reset settings to default
export async function resetSettings(): Promise<AppSettings> {
  try {
    const { error } = await supabase
      .from("settings")
      .upsert([defaultSettings])
      .select()

    if (error) {
      console.error("Error resetting settings:", error)
      throw new Error("Failed to reset settings")
    }

    return defaultSettings
  } catch (error) {
    console.error("Error in resetSettings:", error)
    throw new Error("Failed to reset settings")
  }
}
