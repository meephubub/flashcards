import { supabase } from "./supabase"

export interface StudySettings {
  cardsPerSession: number
  showProgressBar: boolean
  enableSpacedRepetition: boolean
  autoFlip: boolean
  autoFlipDelay: number // in seconds
  languageSimilarityThreshold: number // for language study mode, 0.0 to 1.0
}

export interface AppSettings {
  theme: "light" | "dark" | "system"
  enableAnimations: boolean
  enableSounds: boolean
  enableTTS: boolean
  studySettings: StudySettings
}

// Default settings
const defaultSettings: AppSettings = {
  theme: "system",
  enableAnimations: true,
  enableSounds: false,
  enableTTS: true,
  studySettings: {
    cardsPerSession: 20,
    showProgressBar: true,
    enableSpacedRepetition: false,
    autoFlip: false,
    autoFlipDelay: 5,
    languageSimilarityThreshold: 0.75,
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
          .insert([{
            theme: defaultSettings.theme,
            enable_animations: defaultSettings.enableAnimations,
            enable_sounds: defaultSettings.enableSounds,
            study_settings: defaultSettings.studySettings
          }])
          .select()
          .single()

        if (createError) {
          console.error("Error creating default settings:", createError)
          return defaultSettings
        }

        return {
          theme: newSettings.theme,
          enableAnimations: newSettings.enable_animations,
          enableSounds: newSettings.enable_sounds,
          enableTTS: newSettings.enable_tts,
          studySettings: newSettings.study_settings
        }
      }

      console.error("Error fetching settings:", error)
      return defaultSettings
    }

    return {
      theme: data.theme,
      enableAnimations: data.enable_animations,
      enableSounds: data.enable_sounds,
      enableTTS: data.enable_tts ?? defaultSettings.enableTTS,
      studySettings: data.study_settings
    }
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
      .upsert([{
        theme: settings.theme,
        enable_animations: settings.enableAnimations,
        enable_sounds: settings.enableSounds,
        enable_tts: settings.enableTTS,
        study_settings: settings.studySettings
      }])
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
      .upsert([{
        theme: defaultSettings.theme,
        enable_animations: defaultSettings.enableAnimations,
        enable_sounds: defaultSettings.enableSounds,
        enable_tts: defaultSettings.enableTTS,
        study_settings: defaultSettings.studySettings
      }])
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
