"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  const [userId, setUserId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [evmAddress, setEvmAddress] = useState<string>("");
  const [cid, setCid] = useState<string>("");

  const [verifyLoading, setVerifyLoading] = useState(false);
  const [mintLoading, setMintLoading] = useState(false);

  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);
  const [mintResult, setMintResult] = useState<MintResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);

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

  useEffect(() => {
    const loadUser = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        setUserId(data.user?.id ?? null);
      } catch (e) {
        console.error(e);
        setUserId(null);
      }
    };
    loadUser();
    // Initialize EVM address from prop once, if valid and empty
    if (!evmAddress && defaultEvmAddress && /^0x[a-fA-F0-9]{40}$/.test(defaultEvmAddress)) {
      setEvmAddress(defaultEvmAddress);
    }
  }, []);

  // Derived helpers for displaying mint date
  const mintedAtSeconds = useMemo(() => {
    if (!verifyResult || verifyResult.status !== "minted") return undefined;
    const td = (verifyResult as any).tokenData;
    if (!td || td.mintedAt === undefined || td.mintedAt === null) return undefined;
    const v = typeof td.mintedAt === "string" || typeof td.mintedAt === "number" ? Number(td.mintedAt) : undefined;
    return Number.isFinite(v) ? (v as number) : undefined;
  }, [verifyResult]);

  const [resolveLoading, setResolveLoading] = useState(false);
  const [resolvedMintDate, setResolvedMintDate] = useState<string | null>(null);

  useEffect(() => {
    // Reset resolved hint whenever verify result changes
    setResolvedMintDate(null);
  }, [verifyResult]);

  const resolveMintDateFromLogs = async () => {
    try {
      setResolveLoading(true);
      if (!verifyResult || verifyResult.status !== "minted") throw new Error("Nothing to resolve");
      if (!CONTRACT_ADDRESS) throw new Error("Contract address not available client-side");
      const tokenId = (verifyResult as any).tokenId as number | undefined;
      if (tokenId === undefined) throw new Error("Token ID unavailable");

      const ethereum = (window as any).ethereum;
      if (!ethereum) throw new Error("No injected wallet found");
      const provider = new BrowserProvider(ethereum);
      const contract = new Contract(CONTRACT_ADDRESS, APP_MINT_NFT_ABI, provider);
      // Filter for mint Transfer (from zero address)
      const zero = "0x0000000000000000000000000000000000000000";
      const filter = (contract as any).filters.Transfer(zero, null, tokenId);
      const logs = await (contract as any).queryFilter(filter, BigInt(0), "latest");
      if (!logs || logs.length === 0) throw new Error("No mint Transfer found");
      const first = logs[0];
      const block = await provider.getBlock(first.blockHash ?? first.blockNumber);
      if (!block) throw new Error("Block not found");
      const d = new Date(Number(block.timestamp) * 1000);
      setResolvedMintDate(d.toLocaleString());
    } catch (e) {
      setResolvedMintDate("Unavailable");
    } finally {
      setResolveLoading(false);
    }
  };

  const onPickFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setVerifyResult(null);
    setMintResult(null);
    setError(null);
  };

  const doVerify = async () => {
    try {
      setError(null);
      setMintResult(null);
      setVerifyLoading(true);
      if (!file) {
        throw new Error("Please choose a file to verify.");
      }
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
      setVerifyResult(null);
      setMintLoading(true);
      if (!file) throw new Error("Please choose a file to mint.");
      if (!/^0x[a-fA-F0-9]{40}$/.test(evmAddress)) {
        throw new Error("Enter a valid EVM address (0x...40 hex chars)");
      }
      const fd = new FormData();
      fd.append("file", file);
      fd.append("userAddress", evmAddress);
      if (cid.trim()) fd.append("cid", cid.trim());
      const res = await fetch("/api/mint", { method: "POST", body: fd });
      const json = (await res.json()) as MintResponse;
      if (!res.ok) throw new Error((json as any)?.error || "Mint failed");
      setMintResult(json);
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
      if (!mintResult || ("error" in mintResult) || mintResult.status !== "signed") {
        throw new Error("No signed mint to broadcast");
      }
      if (!CONTRACT_ADDRESS) {
        throw new Error("Missing NEXT_PUBLIC_NFT_CONTRACT_ADDRESS");
      }
      const { eip712, signature } = mintResult as any;
      if (!eip712 || !signature) throw new Error("Missing EIP-712 payload or signature");

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
    } catch (e: any) {
      setBroadcastError(e.message || "Broadcast failed");
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Verify content authenticity</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a document, image, or any file to verify whether it was minted. You can also mint it to your address.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Owner (current user)</div>
            <div className="mt-0.5 select-all rounded-md bg-muted px-2 py-1 text-xs font-mono">
              {userId ? userId : "Not signed in"}
            </div>
          </div>
        </header>

        <section className="mb-8 rounded-xl border border-border bg-card p-5 shadow-sm">
          <label
            htmlFor="file"
            className="block text-sm font-medium text-muted-foreground mb-2"
          >
            File
          </label>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
            <input
              id="file"
              type="file"
              onChange={onPickFile}
              className="block w-full cursor-pointer rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            />
            {file && (
              <span className="truncate text-xs text-muted-foreground">{file.name}</span>
            )}
          </div>

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
              <div className="flex items-center gap-2">
                <input
                  placeholder="Optional IPFS CID for tokenURI"
                  value={cid}
                  onChange={(e) => setCid(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                />
                <button
                  onClick={doMint}
                  disabled={mintLoading || !file || !evmAddress}
                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {mintLoading ? "Minting…" : "Mint"}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Your Supabase user ID will be the human owner reference for this content: {userId ?? "(not signed in)"}
              </p>
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {verifyResult && (
          <section className="mb-6 rounded-xl border border-border bg-card p-5 text-sm">
            <h2 className="mb-2 text-base font-semibold">Verification Result</h2>
            <div className="grid gap-2">
              {(() => {
                if (verifyResult.status === "minted") {
                  const owner = (verifyResult as any).owner as string | undefined;
                  const mine = owner && evmAddress && owner.toLowerCase() === evmAddress.toLowerCase();
                  const statusClass = mine ? "text-green-600" : "text-red-600";
                  return (
                    <>
                      <Row label="Status" value={mine ? "minted (you)" : "minted (not you)"} className={statusClass} />
                    </>
                  );
                }
                return <Row label="Status" value={verifyResult.status} />;
              })()}
              <Row label="Content Hash" value={verifyResult.contentHash} mono />
              {"tokenId" in verifyResult && (
                <Row label="Token ID" value={(verifyResult as any).tokenId?.toString()} />
              )}
              {"owner" in verifyResult && (verifyResult as any).owner && (
                <Row label="Minted by" value={(verifyResult as any).owner} mono />
              )}
              {verifyResult.status === "minted" && (
                (() => {
                  if (mintedAtSeconds && Number.isFinite(mintedAtSeconds)) {
                    const date = new Date(mintedAtSeconds! * 1000).toLocaleString();
                    return <Row label="Minted at" value={date} />;
                  }
                  if (resolvedMintDate) {
                    return <Row label="Minted at" value={resolvedMintDate} />;
                  }
                  if (CONTRACT_ADDRESS && (verifyResult as any).tokenId !== undefined) {
                    return (
                      <div className="col-span-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <button
                          onClick={resolveMintDateFromLogs}
                          disabled={resolveLoading}
                          className="inline-flex h-7 items-center justify-center rounded-md border border-input px-2 text-[11px] hover:bg-muted disabled:opacity-50"
                        >
                          {resolveLoading ? "Resolving…" : "Resolve mint date"}
                        </button>
                        <span>via first Transfer event</span>
                      </div>
                    );
                  }
                  return null;
                })()
              )}
              {"tokenURI" in verifyResult && (verifyResult as any).tokenURI && (
                <Row label="tokenURI" value={(verifyResult as any).tokenURI} />
              )}
            </div>
          </section>
        )}

        {mintResult && (
          <section className="mb-6 rounded-xl border border-border bg-card p-5 text-sm">
            <h2 className="mb-2 text-base font-semibold">Mint Result</h2>
            {"error" in mintResult ? (
              <div className="text-destructive">{mintResult.error}</div>
            ) : (
              <div className="grid gap-2">
                <Row label="Status" value={mintResult.status} />
                <Row label="Content Hash" value={mintResult.contentHash} mono />
                {mintResult.tokenId !== undefined && (
                  <Row label="Token ID" value={mintResult.tokenId.toString()} />
                )}
                {mintResult.txHash && (
                  <Row label="Tx Hash" value={mintResult.txHash} mono />
                )}
                {mintResult.signature && (
                  <Row label="Signature" value={mintResult.signature} mono />
                )}
                {mintResult.status === "signed" && canClientBroadcast && (
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      onClick={broadcastWithWallet}
                      disabled={broadcasting}
                      className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {broadcasting ? "Broadcasting…" : "Broadcast with wallet"}
                    </button>
                    {broadcastError && (
                      <span className="text-xs text-destructive">{broadcastError}</span>
                    )}
                  </div>
                )}
                {mintResult.status === "signed" && !canClientBroadcast && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Server-only mode: set RELAYER_PRIVATE_KEY on the server to auto-broadcast, or expose NEXT_PUBLIC_NFT_CONTRACT_ADDRESS and NEXT_PUBLIC_CHAIN_ID to enable client-side broadcast.
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        <footer className="mt-10 text-center text-xs text-muted-foreground">
          Built for authenticity. Minimal by design.
        </footer>
      </div>
    </div>
  );
}

function Row({ label, value, mono, className }: { label: string; value?: string | number | null; mono?: boolean; className?: string }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="grid grid-cols-3 items-start gap-2">
      <div className="col-span-1 text-muted-foreground">{label}</div>
      <div className={`col-span-2 break-words ${mono ? "font-mono text-[11px]" : ""} ${className ?? ""}`}>{String(value)}</div>
    </div>
  );
}
