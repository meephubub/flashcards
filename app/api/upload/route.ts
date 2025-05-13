import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import sharp from "sharp"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Convert the file to a buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Resize the image to a reasonable size (e.g., max 800px width/height)
    const resizedBuffer = await sharp(buffer)
      .resize(800, 800, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .toBuffer()

    // Create a unique filename
    const timestamp = Date.now()
    const filename = `${timestamp}-${file.name}`

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUB_KEY!
    )

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("img")
      .upload(filename, resizedBuffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false
      })

    if (error) {
      console.error("Error uploading to Supabase:", error)
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from("img")
      .getPublicUrl(filename)

    return NextResponse.json({ url: publicUrl })
  } catch (error) {
    console.error("Error uploading file:", error)
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
  }
} 