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
export async function getSettings(supabase: any): Promise<AppSettings> {
  try {
    // Check if supabase client is properly initialized
    if (!supabase || !supabase.auth) {
      console.error("Supabase client is not properly initialized in getSettings")
      return defaultSettings
    }

    // Get the current user
    const { data: userData, error: authError } = await supabase.auth.getUser()
    
    if (authError || !userData || !userData.user) {
      console.error("Error fetching user or no user logged in for getSettings:", authError)
      return defaultSettings
    }

    const user = userData.user

    // Get user settings
    const { data, error } = await supabase
      .from("settings")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        // No settings found, create default settings for this user
        const { data: newSettings, error: createError } = await supabase
          .from("settings")
          .insert([{
            user_id: user.id,
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

        // Get TTS setting from local storage if available
        let ttsEnabled = defaultSettings.enableTTS;
        if (typeof window !== 'undefined') {
          const storedTTS = localStorage.getItem(`flashcards_enable_tts_${user.id}`);
          if (storedTTS !== null) {
            ttsEnabled = storedTTS === 'true';
          }
        }
        
        return {
          theme: newSettings.theme,
          enableAnimations: newSettings.enable_animations,
          enableSounds: newSettings.enable_sounds,
          enableTTS: ttsEnabled,
          studySettings: newSettings.study_settings
        }
      }

      console.error("Error fetching settings:", error)
      return defaultSettings
    }

    // Get TTS setting from local storage if available
    let ttsEnabled = defaultSettings.enableTTS;
    if (typeof window !== 'undefined') {
      const storedTTS = localStorage.getItem(`flashcards_enable_tts_${user.id}`);
      if (storedTTS !== null) {
        ttsEnabled = storedTTS === 'true';
      }
    }
    
    return {
      theme: data.theme,
      enableAnimations: data.enable_animations,
      enableSounds: data.enable_sounds,
      enableTTS: ttsEnabled,
      studySettings: data.study_settings
    }
  } catch (error) {
    console.error("Error in getSettings:", error)
    return defaultSettings
  }
}

// Save settings
export async function saveSettings(supabase: any, settings: AppSettings): Promise<void> {
  try {
    // Check if supabase client is properly initialized
    if (!supabase || !supabase.auth) {
      console.error("Supabase client is not properly initialized in saveSettings")
      throw new Error("Failed to save settings: Supabase client not initialized")
    }

    // Get the current user
    const { data: userData, error: authError } = await supabase.auth.getUser()
    
    if (authError || !userData || !userData.user) {
      console.error("Error fetching user or no user logged in for saveSettings:", authError)
      throw new Error("Failed to save settings: User not authenticated")
    }

    const user = userData.user

    // Store TTS setting in local storage until database schema is updated
    if (typeof window !== 'undefined') {
      localStorage.setItem(`flashcards_enable_tts_${user.id}`, settings.enableTTS ? 'true' : 'false');
    }
    
    // Convert study settings to a JSON-compatible format
    const studySettingsJson = JSON.stringify(settings.studySettings);
    
    const { error } = await supabase
      .from("settings")
      .upsert({
        user_id: user.id,
        theme: settings.theme,
        enable_animations: settings.enableAnimations,
        enable_sounds: settings.enableSounds,
        // Don't save enable_tts to database until schema is updated
        study_settings: studySettingsJson
      })
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
export async function resetSettings(supabase: any): Promise<AppSettings> {
  try {
    // Check if supabase client is properly initialized
    if (!supabase || !supabase.auth) {
      console.error("Supabase client is not properly initialized in resetSettings")
      throw new Error("Failed to reset settings: Supabase client not initialized")
    }

    // Get the current user
    const { data: userData, error: authError } = await supabase.auth.getUser()
    
    if (authError || !userData || !userData.user) {
      console.error("Error fetching user or no user logged in for resetSettings:", authError)
      throw new Error("Failed to reset settings: User not authenticated")
    }

    const user = userData.user
    
    // Store TTS setting in local storage until database schema is updated
    if (typeof window !== 'undefined') {
      localStorage.setItem(`flashcards_enable_tts_${user.id}`, defaultSettings.enableTTS ? 'true' : 'false');
    }
    
    // Convert study settings to a JSON-compatible format
    const studySettingsJson = JSON.stringify(defaultSettings.studySettings);
    
    const { error } = await supabase
      .from("settings")
      .upsert({
        user_id: user.id,
        theme: defaultSettings.theme,
        enable_animations: defaultSettings.enableAnimations,
        enable_sounds: defaultSettings.enableSounds,
        // Don't save enable_tts to database until schema is updated
        study_settings: studySettingsJson
      })
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
