import { NextResponse } from "next/server";
import { getUser, createClient as createSupabaseServer } from "@/lib/supabase/server";

const ADMIN_USER_ID = process.env.ADMIN_USER_ID || "7a3bda5f-bbac-4262-bd48-b32ec4426e95";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").toLowerCase();
const TOKEN_CONTRACT_ADDRESS = process.env.TOKEN_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_YSH_CONTRACT_ADDRESS;
const RPC_URL = process.env.RPC_URL;
const AIRDROP_PRIVATE_KEY = process.env.AIRDROP_PRIVATE_KEY;

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

export async function POST(req: Request) {
  try {
    const admin = await getUser();
    const isEmailAdmin = ADMIN_EMAIL && (admin?.email || "").toLowerCase() === ADMIN_EMAIL;
    const isIdAdmin = admin?.id === ADMIN_USER_ID;
    if (!admin || !(isEmailAdmin || isIdAdmin)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!RPC_URL) return NextResponse.json({ error: "Missing RPC_URL" }, { status: 500 });
    if (!AIRDROP_PRIVATE_KEY) return NextResponse.json({ error: "Missing AIRDROP_PRIVATE_KEY" }, { status: 500 });
    if (!TOKEN_CONTRACT_ADDRESS) return NextResponse.json({ error: "Missing TOKEN_CONTRACT_ADDRESS" }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const targetUserId: string | undefined = body.targetUserId?.trim() || undefined;
    const targetAddressRaw: string | undefined = body.targetAddress?.trim() || undefined;
    const amountTokens: string = (body.amount ?? "100").toString();

    const supabase = await createSupabaseServer();

    // Resolve address
    let address: string | null = null;
    let userIdForLog: string | null = null;

    if (targetUserId) {
      const { data: w, error: wErr } = await supabase
        .from("wallets")
        .select("address, user_id")
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (wErr) throw wErr;
      if (!w?.address) {
        return NextResponse.json({ error: "Target user has no wallet" }, { status: 400 });
      }
      address = w.address;
      userIdForLog = targetUserId;
    } else if (targetAddressRaw) {
      address = targetAddressRaw;
      // Try to find user id from wallets
      const { data: w } = await supabase
        .from("wallets")
        .select("user_id")
        .eq("address", address)
        .maybeSingle();
      userIdForLog = w?.user_id ?? null;
    } else {
      return NextResponse.json({ error: "Provide targetUserId or targetAddress" }, { status: 400 });
    }

    // Lazy import ethers
    const { ethers } = await import("ethers");
    if (!ethers.isAddress(address!)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(AIRDROP_PRIVATE_KEY, provider);
    const token = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, ERC20_ABI, signer);

    const decimals = Number(await token.decimals());
    const amountWei = ethers.parseUnits(amountTokens, decimals);

    const tx = await token.transfer(address, amountWei);
    const rc = await tx.wait();
    const txHash = tx.hash ?? rc?.transactionHash;

    // Optional log if we have a user id, with idempotency
    if (userIdForLog) {
      const { error: insErr } = await supabase.from("airdrops").insert({
        user_id: userIdForLog,
        token_address: TOKEN_CONTRACT_ADDRESS,
        amount_wei: amountWei.toString(),
        decimals,
        tx_hash: txHash,
      });
      if (insErr) {
        const code = (insErr as any)?.code;
        const msg = String((insErr as any)?.message || "");
        if (code === "23505" || msg.includes("duplicate key value") || msg.includes("Unique violation")) {
          const { data: again } = await supabase
            .from("airdrops")
            .select("tx_hash")
            .eq("user_id", userIdForLog)
            .eq("token_address", TOKEN_CONTRACT_ADDRESS)
            .eq("amount_wei", amountWei.toString())
            .maybeSingle();
          return NextResponse.json({ ok: true, address, amount: amountTokens, txHash: again?.tx_hash ?? txHash });
        }
        throw insErr;
      }
    }

    return NextResponse.json({ ok: true, address, amount: amountTokens, txHash });
  } catch (err: any) {
    console.error("admin/airdrop error", err);
    return NextResponse.json({ error: err?.message || "Failed to airdrop" }, { status: 500 });
  }
}
