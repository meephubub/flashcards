import { NextResponse } from "next/server"
import { getSettings, saveSettings, resetSettings } from "@/lib/settings"

export async function GET() {
  try {
    const settings = getSettings()
    return NextResponse.json(settings)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const settings = await request.json()
    saveSettings(settings)
    return NextResponse.json(settings)
  } catch (error) {
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { action } = await request.json()

    if (action === "reset") {
      const defaultSettings = resetSettings()
      return NextResponse.json(defaultSettings)
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: "Failed to perform settings action" }, { status: 500 })
  }
}
