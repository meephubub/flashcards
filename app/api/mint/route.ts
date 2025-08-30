// Next.js App Router style API handler
// Drop this file into your Next.js project at app/api/mint/route.ts
// This version lives at repo root for your convenience as mint.ts
//
// Env required (server-only):
// - RPC_URL: HTTPS RPC for your target chain
// - NFT_CONTRACT_ADDRESS: deployed AppMintNFT address
// - CHAIN_ID: numeric chain id (e.g., 84532)
// - PRIVATE_SIGNER_KEY: backend signer private key for EIP-712
// - RELAYER_PRIVATE_KEY: optional, if provided the endpoint will also broadcast the mint tx
//
// Form fields (multipart/form-data):
// - file: the content file (required)
// - userAddress: EVM address of recipient (required)
// - cid: IPFS CID for tokenURI (optional but recommended)

import { NextRequest, NextResponse } from "next/server";
import {
  AbiCoder,
  Contract,
  JsonRpcProvider,
  Wallet,
  keccak256,
  toUtf8Bytes,
} from "ethers";

// Minimal ABI for required functions
const APP_MINT_NFT_ABI = [
  "function nonces(address) view returns (uint256)",
  "function contentHashToTokenId(bytes32) view returns (uint256)",
  "function mintWithSig((bytes32 contentHash,address user,uint256 nonce,uint256 expiry,string tokenURICID) m, bytes sig) returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
];

const SIGNING_NAME = "AppMintNFT";
const SIGNING_VERSION = "1";

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getProvider() {
  const rpc = getEnv("RPC_URL");
  return new JsonRpcProvider(rpc);
}

function getContract(provider: any) {
  const address = getEnv("NFT_CONTRACT_ADDRESS");
  return new Contract(address, APP_MINT_NFT_ABI, provider);
}

async function hashFileFromFormData(formData: FormData): Promise<string> {
  const file = formData.get("file");
  if (!file || !(file instanceof File)) throw new Error("file is required");
  const buf = new Uint8Array(await file.arrayBuffer());
  return keccak256(buf);
}

function isValidAddress(addr: string | null): addr is string {
  return !!addr && /^0x[a-fA-F0-9]{40}$/.test(addr);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const userAddress = (formData.get("userAddress") as string) || "";
    const cid = (formData.get("cid") as string) || "";

    if (!isValidAddress(userAddress)) {
      return NextResponse.json(
        { error: "Invalid userAddress" },
        { status: 400 },
      );
    }

    const contentHash = await hashFileFromFormData(formData);

    const provider = getProvider();
    const contract = getContract(provider);

    // Duplicate check
    const existingTokenId = await contract.contentHashToTokenId(contentHash);
    if (BigInt(existingTokenId.toString()) !== BigInt(0)) {
      const tokenId = Number(existingTokenId);
      const [owner, tokenURI] = await Promise.all([
        contract.ownerOf(tokenId).catch(() => null),
        contract.tokenURI(tokenId).catch(() => null),
      ]);
      return NextResponse.json(
        {
          status: "already_minted",
          contentHash,
          tokenId,
          owner,
          tokenURI,
        },
        { status: 409 },
      );
    }

    // Build EIP-712 payload
    const chainId = Number(getEnv("CHAIN_ID"));
    const domain = {
      name: SIGNING_NAME,
      version: SIGNING_VERSION,
      chainId,
      verifyingContract: getEnv("NFT_CONTRACT_ADDRESS"),
    } as const;

    const types = {
      Mint: [
        { name: "contentHash", type: "bytes32" },
        { name: "user", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "expiry", type: "uint256" },
        { name: "tokenURICID", type: "string" },
      ],
    } as const;

    const nonce = await contract.nonces(userAddress);
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 15 * 60; // 15 minutes

    const value = {
      contentHash,
      user: userAddress,
      nonce: BigInt(nonce.toString()),
      expiry,
      tokenURICID: cid,
    } as const;

    // Sign with backend signer
    const signer = new Wallet(getEnv("PRIVATE_SIGNER_KEY"));
    const signature = await signer.signTypedData(
      domain,
      types as any,
      value as any,
    );

    // Optional: broadcast via relayer
    let txHash: string | undefined;
    let tokenId: number | undefined;
    const relayerKey = process.env.RELAYER_PRIVATE_KEY;
    if (relayerKey) {
      const relayer = new Wallet(relayerKey, provider);
      const writeC = contract.connect(relayer) as any;
      const tx = await writeC.mintWithSig(value, signature);
      const rc = await tx.wait();
      txHash = rc.hash;
      try {
        // Attempt to read tokenId from mapping after mint
        const mintedId = await contract.contentHashToTokenId(contentHash);
        if (BigInt(mintedId.toString()) !== BigInt(0)) tokenId = Number(mintedId);
      } catch {}
    }

    // Build a JSON-safe EIP712 payload for the response (no BigInt fields)
    const valueOut = {
      contentHash: value.contentHash,
      user: value.user,
      nonce: nonce.toString(),
      expiry: value.expiry,
      tokenURICID: value.tokenURICID,
    };

    return NextResponse.json({
      status: relayerKey ? "mint_broadcast" : "signed",
      contentHash,
      eip712: { domain, types, value: valueOut },
      signature,
      txHash,
      tokenId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500 },
    );
  }
}
