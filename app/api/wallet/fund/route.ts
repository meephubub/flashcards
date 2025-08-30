import { NextResponse } from "next/server";
import { getUser, createClient as createSupabaseServer } from "@/lib/supabase/server";

const TOKEN_CONTRACT_ADDRESS = process.env.TOKEN_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_YSH_CONTRACT_ADDRESS;
const RPC_URL = process.env.RPC_URL;
const AIRDROP_PRIVATE_KEY = process.env.AIRDROP_PRIVATE_KEY;

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
];

export async function POST() {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!RPC_URL) return NextResponse.json({ error: "Missing RPC_URL" }, { status: 500 });
    if (!AIRDROP_PRIVATE_KEY) return NextResponse.json({ error: "Missing AIRDROP_PRIVATE_KEY" }, { status: 500 });
    if (!TOKEN_CONTRACT_ADDRESS) return NextResponse.json({ error: "Missing TOKEN_CONTRACT_ADDRESS" }, { status: 500 });

    const supabase = await createSupabaseServer();

    // Get user wallet
    const { data: wallet, error: wErr } = await supabase
      .from("wallets")
      .select("address")
      .eq("user_id", user.id)
      .maybeSingle();
    if (wErr) throw wErr;
    if (!wallet?.address) return NextResponse.json({ error: "No wallet for user" }, { status: 400 });

    // Lazy import ethers
    const { ethers } = await import("ethers");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(AIRDROP_PRIVATE_KEY, provider);
    const token = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, ERC20_ABI, signer);

    // Read decimals and symbol
    const [decimals, symbol] = await Promise.all([token.decimals(), token.symbol()]);
    const decimalsNum = Number(decimals);

    // Compute amount = 100 tokens in wei
    const amountWei = ethers.parseUnits("100", decimalsNum);

    // Idempotency: check if we already airdropped this exact amount for this token
    const { data: existing, error: adErr } = await supabase
      .from("airdrops")
      .select("id, tx_hash")
      .eq("user_id", user.id)
      .eq("token_address", TOKEN_CONTRACT_ADDRESS)
      .eq("amount_wei", amountWei.toString())
      .maybeSingle();
    if (adErr) throw adErr;
    if (existing) {
      return NextResponse.json({ status: "already_funded", address: wallet.address, txHash: existing.tx_hash, symbol });
    }

    // Perform transfer
    const tx = await token.transfer(wallet.address, amountWei);
    const rc = await tx.wait();
    const txHash = tx.hash ?? rc?.transactionHash;

    // Log airdrop with duplicate handling
    const { error: insErr } = await supabase.from("airdrops").insert({
      user_id: user.id,
      token_address: TOKEN_CONTRACT_ADDRESS,
      amount_wei: amountWei.toString(),
      decimals: decimalsNum,
      tx_hash: txHash,
    });
    if (insErr) {
      const code = (insErr as any)?.code;
      const msg = String((insErr as any)?.message || "");
      if (code === "23505" || msg.includes("duplicate key value") || msg.includes("Unique violation")) {
        const { data: again } = await supabase
          .from("airdrops")
          .select("tx_hash")
          .eq("user_id", user.id)
          .eq("token_address", TOKEN_CONTRACT_ADDRESS)
          .eq("amount_wei", amountWei.toString())
          .maybeSingle();
        return NextResponse.json({ status: "already_funded", address: wallet.address, txHash: again?.tx_hash ?? txHash, symbol });
      }
      throw insErr;
    }

    return NextResponse.json({ status: "funded", address: wallet.address, txHash, symbol });
  } catch (err: any) {
    console.error("wallet/fund error", err);
    return NextResponse.json({ error: err?.message || "Failed to fund wallet" }, { status: 500 });
  }
}
