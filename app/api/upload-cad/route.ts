import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const admin = createSupabaseAdmin(supabaseUrl, serviceKey);

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 415 });
    }

    const form = await req.formData();
    const file = form.get("file");
    const userId = String(form.get("user_id") || "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field" }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    const fileName = file.name || `model-${Date.now()}`;
    const arrayBuf = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);

    const path = `${userId}/${Date.now()}_${fileName}`;
    const { error: upErr } = await admin.storage
      .from("cad")
      .upload(path, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });
    if (upErr) {
      return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/cad/${encodeURI(path)}`;
    return NextResponse.json({ url: publicUrl, path });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
