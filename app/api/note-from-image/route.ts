import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

// Helper to ensure env vars
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function POST(req: Request) {
  // Determine if we are in dev environment via cookie set by the client UI
  const cookieHeader = req.headers.get('cookie') || ''
  const envCookie = /(?:^|;\s*)ENVIRONMENT=([^;]+)/.exec(cookieHeader)?.[1]
  const isDev = (envCookie === 'dev')
  const debug: Record<string, any> = {}
  try {
    const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const admin = createSupabaseAdmin(supabaseUrl, serviceKey);

    // Accept either a direct image URL or a file upload
    const contentType = req.headers.get("content-type") || "";

    let publicImageUrl: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing file field" }, { status: 400 });
      }

      const fileName = file.name || `upload-${Date.now()}`;
      const arrayBuf = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);

      const storagePath = `uploads/${fileName}`; // marker/uploads/<filename> (bucket is marker)
      const { error: upErr } = await admin.storage
        .from("marker")
        .upload(storagePath, bytes, {
          contentType: file.type || "application/octet-stream",
          upsert: true,
        });
      if (upErr) {
        return NextResponse.json({ error: `Failed to upload: ${upErr.message}` }, { status: 500 });
      }
      const publicBase = `${supabaseUrl}/storage/v1/object/public/marker`;
      publicImageUrl = `${publicBase}/${storagePath}`;
      if (isDev) debug.upload = { storagePath, publicImageUrl }
    } else if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => null);
      if (!body?.image_url) {
        return NextResponse.json({ error: "Missing image_url in JSON body" }, { status: 400 });
      }
      publicImageUrl = body.image_url as string;
    } else {
      return NextResponse.json({ error: "Unsupported content type" }, { status: 415 });
    }

    // Call processing endpoint (send as both query param AND JSON body for compatibility)
    const processBase = "https://harmless-thoroughly-moth.ngrok-free.app/process";
    const processUrl = `${processBase}?image_url=${encodeURIComponent(publicImageUrl || "")}`;
    if (isDev) debug.processor = { processUrl, body: { image_url: publicImageUrl } }
    const procRes = await fetch(processUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image_url: publicImageUrl }),
    });
    if (!procRes.ok) {
      const txt = await procRes.text().catch(() => "");
      const payload: any = { error: `Processor error: ${procRes.status} ${txt}`, sent_image_url: publicImageUrl }
      if (isDev) payload.debug = { ...debug, processorResponse: { status: procRes.status, text: txt } }
      return NextResponse.json(payload, { status: 502 });
    }

    // Read raw response and attempt robust parsing
    const raw = await procRes.text();
    if (isDev) debug.processorRaw = raw
    let proc: any = {};
    try { proc = JSON.parse(raw) } catch { proc = {} }

    // Expected response contains where images and md were uploaded, e.g. "IMG_2272/IMG_2272/IMG_2272.md"
    // Try many common fields and nested structures
    let mdPath: string | undefined =
      proc.md_path ||
      proc.markdown_path ||
      proc.note_path ||
      proc.md ||
      proc.path ||
      proc?.paths?.md ||
      proc?.paths?.markdown ||
      proc?.output?.md_path ||
      proc?.output?.markdown_path ||
      proc?.outputs?.markdown?.path;

    const publicBase = `${supabaseUrl}/storage/v1/object/public/marker`;
    let mdUrl: string | undefined = undefined
    // If absolute URL provided
    const absUrl: string | undefined = proc.markdown_url || proc.md_url || proc.url;
    if (!mdPath && absUrl && /^https?:\/\//i.test(absUrl)) {
      mdUrl = absUrl
      // Attempt to derive mdPath relative to publicBase if possible
      if (absUrl.startsWith(publicBase + "/")) mdPath = absUrl.slice(publicBase.length + 1)
    }

    // Fallback: regex search for first .md-like path inside raw
    if (!mdPath) {
      const m = raw.match(/[A-Za-z0-9_\-/.]+\.md/)
      if (m) mdPath = m[0]
    }

    if (!mdPath && !mdUrl) {
      const payload: any = { error: "Processor did not return md path" }
      if (isDev) payload.debug = debug
      return NextResponse.json(payload, { status: 500, statusText: "Bad processor response" });
    }

    // Fetch the markdown content from public storage
    // Compute mdUrl if not provided
    mdUrl = mdUrl || `${publicBase}/${mdPath}`;
    let markdown = "";
    try {
      const mdRes = await fetch(mdUrl);
      if (!mdRes.ok) throw new Error(`Failed to fetch markdown: ${mdRes.status}`);
      markdown = await mdRes.text();
    } catch (e: any) {
      const payload: any = { error: e?.message || "Failed to load markdown", markdown_url: mdUrl }
      if (isDev) payload.debug = { ...debug, mdPath, mdUrl }
      return NextResponse.json(payload, { status: 500 });
    }

    // Compute base directory for images from mdPath or from mdUrl when mdPath is absent
    const derivedPath = mdPath || (mdUrl && mdUrl.startsWith(publicBase + "/") ? mdUrl.slice(publicBase.length + 1) : "")
    const lastSlash = derivedPath.lastIndexOf("/");
    const mdDir = lastSlash >= 0 ? derivedPath.slice(0, lastSlash) : "";

    // Optional: list of images from processor to help mapping
    const images: string[] = Array.isArray(proc.images) ? proc.images : [];

    // Replace any relative image tags ![...](relative) with absolute public URLs
    // Matches ![alt](url)
    let rewriteCount = 0
    markdown = markdown.replace(/!\[[^\]]*\]\(([^)]+)\)/g, (m, p1) => {
      const original = String(p1).trim();
      if (/^https?:\/\//i.test(original)) return m;
      const rel = original.replace(/^\.\//, "");
      const full = `${publicBase}/${mdDir ? mdDir + "/" : ""}${rel}`;
      rewriteCount++
      return m.replace(p1, full);
    });
    if (isDev) debug.markdown = { mdPath, mdUrl, rewriteCount }

    // Derive a title from path or processor response
    const baseName = (derivedPath.split("/").pop() || "note.md");
    const title = (proc.title as string) || baseName.replace(/\.md$/i, "");

    const payload: any = {
      success: true,
      image_url: publicImageUrl,
      markdown_url: mdUrl,
      title,
      content: markdown,
      md_path: mdPath,
      images,
    }
    if (isDev) payload.debug = debug
    return NextResponse.json(payload);
  } catch (e: any) {
    const payload: any = { error: e?.message || "Unknown error" }
    if (isDev) payload.debug = debug
    return NextResponse.json(payload, { status: 500 });
  }
}
