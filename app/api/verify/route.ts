// Next.js App Router style API handler
// Drop this file into your Next.js project at app/api/verify/route.ts
// This version lives at repo root for your convenience as verify.ts
//
// Env required (server-only):
// - RPC_URL: HTTPS RPC for your target chain
// - NFT_CONTRACT_ADDRESS: deployed AppMintNFT address
//
// Form fields (multipart/form-data):
// - file: the content file (required)

import { NextRequest, NextResponse } from "next/server";
import { Contract, JsonRpcProvider, keccak256 } from "ethers";

const APP_MINT_NFT_ABI = [
  "function contentHashToTokenId(bytes32) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function tokenData(uint256 tokenId) view returns (address user, uint64 mintedAt, uint64 expiry, string tokenURI)",
];

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getProvider() {
  return new JsonRpcProvider(getEnv("RPC_URL"));
}

function getContract(provider: any) {
  return new Contract(
    getEnv("NFT_CONTRACT_ADDRESS"),
    APP_MINT_NFT_ABI,
    provider,
  );
}

async function hashFileFromFormData(formData: FormData): Promise<string> {
  const file = formData.get("file");
  if (!file || !(file instanceof File)) throw new Error("file is required");
  const buf = new Uint8Array(await file.arrayBuffer());
  return keccak256(buf);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const contentHash = await hashFileFromFormData(formData);

    const provider = getProvider();
    const contract = getContract(provider);

    const tokenIdBN = await contract.contentHashToTokenId(contentHash);
    if (BigInt(tokenIdBN.toString()) === BigInt(0)) {
      return NextResponse.json(
        { status: "not_minted", contentHash },
        { status: 404 },
      );
    }

    const tokenId = Number(tokenIdBN);

    // Try enriched info
    let owner: string | null = null;
    let tokenURI: string | null = null;
    let tokenData: any = null;
    try {
      owner = await contract.ownerOf(tokenId);
    } catch {}
    try {
      tokenURI = await contract.tokenURI(tokenId);
    } catch {}
    try {
      tokenData = await contract.tokenData(tokenId);
    } catch {}

    // Safely serialize potential BigInt fields from tokenData
    const safeTokenData = tokenData
      ? {
          user: tokenData.user,
          mintedAt:
            typeof tokenData.mintedAt === "bigint"
              ? tokenData.mintedAt.toString()
              : tokenData.mintedAt,
          expiry:
            typeof tokenData.expiry === "bigint"
              ? tokenData.expiry.toString()
              : tokenData.expiry,
          tokenURI: tokenData.tokenURI,
        }
      : null;

    return NextResponse.json({
      status: "minted",
      contentHash,
      tokenId,
      owner,
      tokenURI,
      tokenData: safeTokenData,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500 },
    );
  }
}
