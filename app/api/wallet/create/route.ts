import { NextResponse } from "next/server";
import { randomBytes, createCipheriv } from "crypto";
import { getUser, createClient as createSupabaseServer } from "@/lib/supabase/server";

// AES-256-GCM encryption helper
function encryptPrivateKey(pk: string, base64Key: string) {
  if (!base64Key) throw new Error("Missing ENCRYPTION_KEY");
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes base64");
  const iv = randomBytes(12); // GCM recommended 96-bit IV
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(pk, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // store iv + tag + ciphertext separately or together; we'll store iv and (ciphertext||tag)
  const payload = Buffer.concat([ciphertext, tag]).toString("base64");
  return { iv: iv.toString("base64"), ciphertext: payload };
}

export async function POST() {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = await createSupabaseServer();

    // Check if wallet already exists (fast path)
    const { data: existing, error: selErr } = await supabase
      .from("wallets")
      .select("address")
      .eq("user_id", user.id)
      .maybeSingle();
    if (selErr) throw selErr;
    if (existing) {
      return NextResponse.json({ address: existing.address, created: false });
    }

    // Lazy import ethers to avoid edge bundle issues
    const { ethers } = await import("ethers");
    const wallet = ethers.Wallet.createRandom();

    const enc = encryptPrivateKey(wallet.privateKey, process.env.ENCRYPTION_KEY || "");

    // Idempotent insert (handle parallel calls): try insert, if duplicate, fetch existing
    const { error: insErr } = await supabase
      .from("wallets")
      .insert({
        user_id: user.id,
        address: wallet.address,
        iv: enc.iv,
        ciphertext: enc.ciphertext,
      });
    if (insErr) {
      // Unique violation -> someone created it concurrently
      const code = (insErr as any)?.code;
      const msg = String((insErr as any)?.message || "");
      if (code === "23505" || msg.includes("duplicate key value") || msg.includes("Unique violation")) {
        const { data: again } = await supabase
          .from("wallets")
          .select("address")
          .eq("user_id", user.id)
          .maybeSingle();
        return NextResponse.json({ address: again?.address ?? wallet.address, created: false });
      }
      throw insErr;
    }

    return NextResponse.json({ address: wallet.address, created: true });
  } catch (err: any) {
    console.error("wallet/create error", err);
    return NextResponse.json({ error: err?.message || "Failed to create wallet" }, { status: 500 });
  }
}
