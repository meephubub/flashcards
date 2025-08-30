import { NextResponse } from "next/server";
import { ethers } from "ethers";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_YSH_CONTRACT_ADDRESS;
const RPC_URL = process.env.RPC_URL;

const ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address")?.trim() ?? "";

    if (!address || !ethers.isAddress(address)) {
      return NextResponse.json({ error: "Invalid or missing address" }, { status: 400 });
    }

    if (!RPC_URL) {
      return NextResponse.json({ error: "Missing RPC_URL" }, { status: 500 });
    }
    if (!CONTRACT_ADDRESS) {
      return NextResponse.json({ error: "Missing NEXT_PUBLIC_YSH_CONTRACT_ADDRESS" }, { status: 500 });
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const token = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    const [balanceRaw, decimals, symbol] = await Promise.all([
      token.balanceOf(address),
      token.decimals(),
      token.symbol(),
    ]);

    const decimalsNum = Number(decimals);
    const balance = ethers.formatUnits(balanceRaw, decimalsNum);
    return NextResponse.json({ address: String(address), balance, symbol: String(symbol), decimals: decimalsNum });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch balance" }, { status: 500 });
  }
}
