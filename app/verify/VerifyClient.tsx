"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrowserProvider, Contract } from "ethers";

type VerifyResponse =
  | {
      status: "minted";
      contentHash: string;
      tokenId: number;
      owner?: string | null;
      tokenURI?: string | null;
      tokenData?: any;
    }
  | {
      status: "not_minted";
      contentHash: string;
    };

type MintResponse =
  | {
      status: "signed" | "mint_broadcast" | "already_minted";
      contentHash: string;
      eip712?: any;
      signature?: string;
      txHash?: string;
      tokenId?: number;
      owner?: string | null;
      tokenURI?: string | null;
    }
  | { error: string };

export default function VerifyClient({ defaultEvmAddress }: { defaultEvmAddress?: string }) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [evmAddress, setEvmAddress] = useState<string>("");
  const [cid, setCid] = useState<string>("");

  const [verifyLoading, setVerifyLoading] = useState(false);
  const [mintLoading, setMintLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [walletLoading, setWalletLoading] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);
  const [mintResult, setMintResult] = useState<MintResponse | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS;
  const PUBLIC_CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID
    ? Number(process.env.NEXT_PUBLIC_CHAIN_ID)
    : undefined;
  const canClientBroadcast = Boolean(CONTRACT_ADDRESS);

  const APP_MINT_NFT_ABI = [
    "function mintWithSig((bytes32 contentHash,address user,uint256 nonce,uint256 expiry,string tokenURICID) m, bytes sig) returns (uint256)",
    "function contentHashToTokenId(bytes32) view returns (uint256)",
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  ];

  const supabase = createClient();

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setUserId(data.user?.id ?? null);
      } catch (e) {
        console.error(e);
        setUserId(null);
      }
    };

    loadUser();

    if (!evmAddress && defaultEvmAddress && /^0x[a-fA-F0-9]{40}$/.test(defaultEvmAddress)) {
      setEvmAddress(defaultEvmAddress);
    }
  }, [defaultEvmAddress, evmAddress, supabase]);

  const loadWalletAddress = async () => {
    if (!userId) return;
    setWalletLoading(true);
    try {
      const { data: wallet, error: wErr } = await supabase
        .from("wallets")
        .select("address")
        .eq("user_id", userId)
        .maybeSingle();
      if (wErr) throw wErr;
      const address = wallet?.address || "";
      setWalletAddress(address);
      if (address && !evmAddress) setEvmAddress(address);
    } catch (e) {
      console.error("Failed to load wallet address:", e);
      setWalletAddress("");
    } finally {
      setWalletLoading(false);
    }
  };

  useEffect(() => {
    void loadWalletAddress();
  }, [userId]);

  const doVerify = async () => {
    try {
      setError(null);
      setSuccess(null);
      setMintResult(null);
      setVerifyLoading(true);
      if (!file) throw new Error("Please choose a file to verify.");
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/verify", { method: "POST", body: fd });
      const json = await res.json();
      if (res.status === 404 && json?.status === "not_minted") {
        setVerifyResult(json as VerifyResponse);
        return;
      }
      if (!res.ok) throw new Error(json?.error || "Verification failed");
      setVerifyResult(json as VerifyResponse);
    } catch (e: any) {
      setError(e.message || "Verification error");
    } finally {
      setVerifyLoading(false);
    }
  };

  const doMint = async () => {
    try {
      setError(null);
      setSuccess(null);
      setVerifyResult(null);
      setMintLoading(true);
      if (!file) throw new Error("Please choose a file to mint.");
      if (!/^0x[a-fA-F0-9]{40}$/.test(evmAddress))
        throw new Error("Enter a valid EVM address (0x…40 hex chars)");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("userAddress", evmAddress);
      if (cid.trim()) fd.append("cid", cid.trim());
      const res = await fetch("/api/mint", { method: "POST", body: fd });
      const json = (await res.json()) as MintResponse;
      // Handle already minted (HTTP 409) gracefully
      if (res.status === 409 && (json as any)?.status === "already_minted") {
        setMintResult(json);
        return;
      }
      // Some backends may return 200 with status already_minted
      if ((json as any)?.status === "already_minted") {
        setMintResult(json);
        return;
      }
      if (!res.ok) throw new Error((json as any)?.error || "Mint failed");
      setMintResult(json);
      if ((json as any)?.status === "mint_broadcast") {
        setSuccess("Mint successful");
      }
    } catch (e: any) {
      setError(e.message || "Mint error");
    } finally {
      setMintLoading(false);
    }
  };

  const broadcastWithWallet = async () => {
    try {
      setBroadcastError(null);
      setBroadcasting(true);
      if (!mintResult || "error" in mintResult || mintResult.status !== "signed")
        throw new Error("No signed mint to broadcast");
      if (!CONTRACT_ADDRESS) throw new Error("Missing NEXT_PUBLIC_NFT_CONTRACT_ADDRESS");
      const { eip712, signature } = mintResult as any;
      if (!eip712 || !signature)
        throw new Error("Missing EIP-712 payload or signature");

      const ethereum = (window as any).ethereum;
      if (!ethereum) throw new Error("No injected wallet found");

      const provider = new BrowserProvider(ethereum);
      const signer = await provider.getSigner();

      const net = await provider.getNetwork();
      if (PUBLIC_CHAIN_ID && Number(net.chainId) !== PUBLIC_CHAIN_ID) {
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x" + PUBLIC_CHAIN_ID.toString(16) }],
        });
      }

      const contract = new Contract(CONTRACT_ADDRESS, APP_MINT_NFT_ABI, signer);
      const value = {
        contentHash: eip712.value.contentHash as string,
        user: eip712.value.user as string,
        nonce: BigInt(eip712.value.nonce),
        expiry: Number(eip712.value.expiry),
        tokenURICID: (eip712.value.tokenURICID as string) || "",
      } as const;

      const tx = await (contract as any).mintWithSig(value, signature);
      const rc = await tx.wait();

      let tokenId: number | undefined;
      try {
        const mintedId = await contract.contentHashToTokenId(value.contentHash);
        if (BigInt(mintedId.toString()) !== BigInt(0)) tokenId = Number(mintedId);
      } catch {}

      setMintResult({
        status: "mint_broadcast",
        contentHash: (mintResult as any).contentHash,
        eip712,
        signature,
        txHash: rc.hash,
        tokenId,
      } as MintResponse);
      setSuccess("Mint successful");
    } catch (e: any) {
      setBroadcastError(e.message || "Broadcast failed");
    } finally {
      setBroadcasting(false);
    }
  };

  // Show sign-in prompt if user is not authenticated
  if (!userId) {
    return (
      <div className="min-h-[calc(100vh-4rem)] w-full bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="flex flex-col items-center justify-center text-center space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">
                Sign in required
              </h1>
              <p className="text-lg text-muted-foreground max-w-md">
                You need to sign in to verify content authenticity and mint NFTs.
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => router.push("/signup")}
                className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-8 text-base font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                Sign up / Sign in
              </button>

              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <button
                  onClick={() => router.push("/signup")}
                  className="text-primary hover:underline"
                >
                  Create one here
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Verify content authenticity
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a document, image, or any file to verify whether it was minted. You can also
              mint it to your address.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Owner (current user)</div>
            <div className="mt-0.5 select-all rounded-md bg-muted px-2 py-1 text-xs font-mono">
              {userId || "Not signed in"}
            </div>
          </div>
        </header>

        {/* File input */}
        <section className="mb-8 rounded-xl border border-border bg-card p-5 shadow-sm">
          <label htmlFor="file" className="block text-sm font-medium text-muted-foreground mb-2">
            File
          </label>
          <input
            id="file"
            type="file"
            onChange={onPickFile}
            className="block w-full cursor-pointer rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              onClick={doVerify}
              disabled={verifyLoading || !file}
              className="inline-flex h-10 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {verifyLoading ? "Verifying…" : "Verify"}
            </button>
            <div className="flex flex-col gap-3">
              <input
                placeholder="Your EVM address (0x…)"
                value={evmAddress}
                onChange={(e) => setEvmAddress(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              />
              <input
                placeholder="Optional IPFS CID for tokenURI"
                value={cid}
                onChange={(e) => setCid(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              />
              <button
                onClick={doMint}
                disabled={
                  mintLoading ||
                  !file ||
                  !evmAddress ||
                  !userId ||
                  (verifyResult?.status === "minted") ||
                  (mintResult && "status" in mintResult && mintResult.status === "already_minted")
                }
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mintLoading ? "Minting…" : "Mint"}
              </button>
              {(verifyResult?.status === "minted" || (mintResult && "status" in mintResult && mintResult.status === "already_minted")) && (
                <div className="text-xs text-muted-foreground">
                  This content is already minted. Minting is disabled.
                </div>
              )}
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-500">
            {success}
          </div>
        )}

        {/* Verification & Mint Results */}
        {verifyResult && (
          <section className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium text-muted-foreground">Verification</div>
              <div
                className={`rounded-md px-2 py-1 text-xs ${
                  verifyResult.status === "minted"
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-amber-500/10 text-amber-500"
                }`}
              >
                {verifyResult.status === "minted" ? "Minted" : "Not minted"}
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <Row label="Content hash" value={(verifyResult as any).contentHash} mono />
              {verifyResult.status === "minted" && (
                <>
                  <Row label="Token ID" value={(verifyResult as any).tokenId} mono />
                  <Row label="Owner" value={(verifyResult as any).owner} mono />
                  <Row
                    label="Minter"
                    value={(verifyResult as any).tokenData?.user || (verifyResult as any).owner}
                    mono
                    className={
                      ((walletAddress || "").toLowerCase() === (((verifyResult as any).tokenData?.user || (verifyResult as any).owner) || "").toLowerCase())
                        ? "text-emerald-500"
                        : "text-red-500"
                    }
                  />
                  <Row label="Token URI" value={(verifyResult as any).tokenURI} mono />
                </>
              )}
            </div>
          </section>
        )}

        {mintResult && (
          <section className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium text-muted-foreground">Mint</div>
              <div
                className={`rounded-md px-2 py-1 text-xs ${
                  mintResult.status === "mint_broadcast"
                    ? "bg-emerald-500/10 text-emerald-500"
                    : mintResult.status === "already_minted"
                    ? "bg-blue-500/10 text-blue-500"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {mintResult.status === "signed"
                  ? "Signed"
                  : mintResult.status === "mint_broadcast"
                  ? "Broadcasted"
                  : "Already minted"}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <Row label="Content hash" value={(mintResult as any).contentHash} mono />
              {mintResult.status === "already_minted" && (
                <>
                  <Row label="Token ID" value={(mintResult as any).tokenId} mono />
                  <Row label="Owner" value={(mintResult as any).owner} mono />
                  <Row label="Token URI" value={(mintResult as any).tokenURI} mono />
                </>
              )}
              {mintResult.status === "mint_broadcast" && (
                <>
                  <Row label="Tx hash" value={(mintResult as any).txHash} mono />
                  <Row label="Token ID" value={(mintResult as any).tokenId} mono />
                </>
              )}
            </div>

            {mintResult.status === "signed" && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  Signature ready. Broadcast to mint on-chain.
                </div>
                {canClientBroadcast && (
                  <button
                    onClick={broadcastWithWallet}
                    disabled={broadcasting}
                    className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {broadcasting ? "Broadcasting…" : "Broadcast with wallet"}
                  </button>
                )}
              </div>
            )}

            {broadcastError && (
              <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                {broadcastError}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value?: string | number | null;
  mono?: boolean;
  className?: string;
}) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="grid grid-cols-3 items-start gap-2">
      <div className="col-span-1 text-muted-foreground">{label}</div>
      <div
        className={`col-span-2 break-words ${mono ? "font-mono text-[11px]" : ""} ${
          className ?? ""
        }`}
      >
        {String(value)}
      </div>
    </div>
  );
}
