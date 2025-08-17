import { NextResponse } from "next/server"

export const runtime = "nodejs"

// Lazy require to avoid bundling on edge
let pdfjsLib: any
let mammoth: any

async function ensureDeps() {
  if (!mammoth) {
    mammoth = await import("mammoth")
  }
  if (!pdfjsLib) {
    // Use legacy build for broader Node compatibility
    pdfjsLib = await import("pdfjs-dist")
    try {
      // Avoid trying to load a separate worker file in Node
      if ((pdfjsLib as any).GlobalWorkerOptions) {
        ;(pdfjsLib as any).GlobalWorkerOptions.workerSrc = ''
      }
    } catch {}
  }
}

export async function POST(req: Request) {
  try {
    await ensureDeps()

    const form = await req.formData()
    const files = form.getAll("files") as File[]
    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 })
    }

    let combined = ""

    for (const file of files) {
      const arrayBuf = await file.arrayBuffer()
      const buf = Buffer.from(arrayBuf)
      const name = file.name.toLowerCase()

      if (name.endsWith(".pdf")) {
        try {
          // Extract text with pdfjs-dist
          const loadingTask = (pdfjsLib as any).getDocument({ data: new Uint8Array(buf) })
          const pdf = await loadingTask.promise
          let text = ""
          for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p)
            const content = await page.getTextContent()
            const strings = (content.items || []).map((it: any) => (it.str || ""))
            text += strings.join(" ") + "\n\n"
          }
          combined += `\n\n# ${file.name}\n\n${text}\n`
        } catch (e) {
          combined += `\n\n# ${file.name}\n\n[Failed to extract PDF text]\n`
        }
      } else if (name.endsWith(".docx")) {
        try {
          const res = await (mammoth as any).extractRawText({ buffer: buf })
          combined += `\n\n# ${file.name}\n\n${res.value}\n`
        } catch (e) {
          combined += `\n\n# ${file.name}\n\n[Failed to extract DOCX text]\n`
        }
      } else if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".markdown")) {
        combined += `\n\n# ${file.name}\n\n${buf.toString("utf8")}\n`
      } else if (name.endsWith(".html") || name.endsWith(".htm")) {
        // naive strip HTML
        const text = buf.toString("utf8").replace(/<[^>]+>/g, " ")
        combined += `\n\n# ${file.name}\n\n${text}\n`
      } else {
        combined += `\n\n# ${file.name}\n\n[Unsupported file type: ${file.type || "unknown"}]\n`
      }
    }

    const text = combined.trim()
    return NextResponse.json({ text })
  } catch (err: any) {
    console.error("/api/extract-text error", err)
    return NextResponse.json({ error: err?.message || "Extraction failed" }, { status: 500 })
  }
}

