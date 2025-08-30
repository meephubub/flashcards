import { createClient, getUser } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const ADMIN_USER_ID = process.env.ADMIN_USER_ID || "7a3bda5f-bbac-4262-bd48-b32ec4426e95";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").toLowerCase();

export default async function AdminPage() {
  const user = await getUser();
  const isEmailAdmin = ADMIN_EMAIL && (user?.email || "").toLowerCase() === ADMIN_EMAIL;
  const isIdAdmin = user?.id === ADMIN_USER_ID;
  if (!user || !(isEmailAdmin || isIdAdmin)) {
    redirect("/");
  }

  async function getTokenMeta() {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/balance?address=0x0000000000000000000000000000000000000000`, { cache: "no-store" });
      // Not ideal; balance route expects address; this call is just to ensure server working.
      // We'll not rely on it here.
    } catch {}
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Airdrop</h1>
      <p className="text-sm text-gray-500 mb-6">Send tokens to a user (by user ID) or directly to a wallet address.</p>

      <form
        className="space-y-4"
        action={async (formData: FormData) => {
          "use server";
          const supabase = await createClient();
          const { data: { user: sessionUser } } = await supabase.auth.getUser();
          const isEmailAdmin2 = ADMIN_EMAIL && (sessionUser?.email || "").toLowerCase() === ADMIN_EMAIL;
          const isIdAdmin2 = sessionUser?.id === ADMIN_USER_ID;
          if (!sessionUser || !(isEmailAdmin2 || isIdAdmin2)) {
            redirect("/");
          }
          const targetUserId = String(formData.get("targetUserId") || "").trim();
          const targetAddress = String(formData.get("targetAddress") || "").trim();
          const amount = String(formData.get("amount") || "100").trim();

          // Build absolute URL from current request headers
          const h = await headers();
          const host = h.get("host");
          const proto = h.get("x-forwarded-proto") ?? "http";
          const base = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000");
          const cookie = h.get("cookie") ?? "";

          await fetch(`${base}/api/admin/airdrop`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie },
            body: JSON.stringify({ targetUserId: targetUserId || undefined, targetAddress: targetAddress || undefined, amount }),
          });
        }}
      >
        <div>
          <label className="block text-sm font-medium">Target User ID (optional)</label>
          <input name="targetUserId" className="mt-1 w-full border rounded px-3 py-2 bg-transparent" placeholder="uuid" />
        </div>
        <div>
          <label className="block text-sm font-medium">Or Target Address (0x...)</label>
          <input name="targetAddress" className="mt-1 w-full border rounded px-3 py-2 bg-transparent" placeholder="0x..." />
        </div>
        <div>
          <label className="block text-sm font-medium">Amount (tokens)</label>
          <input name="amount" defaultValue="100" className="mt-1 w-full border rounded px-3 py-2 bg-transparent" />
        </div>
        <button type="submit" className="px-4 py-2 rounded bg-black text-white">Send</button>
      </form>
    </div>
  );
}
