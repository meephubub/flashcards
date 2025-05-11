import fs from "fs"
import path from "path"
import { initializeDataStorage } from "./data"

// Define the data directory path
const DATA_DIR = path.join(process.cwd(), "data")
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json")

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
export function getSettings(): AppSettings {
  try {
    initializeDataStorage()

    if (!fs.existsSync(SETTINGS_FILE)) {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2))
      return defaultSettings
    }

    const data = fs.readFileSync(SETTINGS_FILE, "utf8")
    return JSON.parse(data)
  } catch (error) {
    console.error("Error reading settings:", error)
    return defaultSettings
  }
}

// Save settings
export function saveSettings(settings: AppSettings) {
  try {
    initializeDataStorage()
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))
  } catch (error) {
    console.error("Error saving settings:", error)
    throw new Error("Failed to save settings")
  }
}

// Reset settings to default
export function resetSettings() {
  try {
    initializeDataStorage()
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2))
    return defaultSettings
  } catch (error) {
    console.error("Error resetting settings:", error)
    throw new Error("Failed to reset settings")
  }
}
