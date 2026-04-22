import { EditCardPageClient } from "@/components/edit-card-page-client";

export default async function EditCardPage({
  params,
}: {
  params: Promise<{ id: string; cardId: string }>;
}) {
  const { id, cardId: cardIdStr } = await params;
  const deckId = Number.parseInt(id);
  const cardId = Number.parseInt(cardIdStr);

  if (Number.isNaN(deckId) || Number.isNaN(cardId)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black/5">
        <p className="text-sm text-neutral-700">Invalid parameters.</p>
      </div>
    );
  }

  return <EditCardPageClient deckId={deckId} cardId={cardId} />;
}
