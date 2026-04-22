import { AddCardPageClient } from "@/components/add-card-page-client";

export default async function AddCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deckId = Number.parseInt(id);

  if (Number.isNaN(deckId)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black/5">
        <p className="text-sm text-neutral-700">Invalid deck id.</p>
      </div>
    );
  }

  return <AddCardPageClient initialDeckId={deckId} />;
}
