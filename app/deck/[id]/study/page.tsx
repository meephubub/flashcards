import { StudyPageClient } from "@/components/study-page-client";

export default async function StudyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tag?: string }>;
}) {
  const { id } = await params;
  const { tag } = await searchParams;
  const deckId = Number.parseInt(id);

  if (Number.isNaN(deckId)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white text-black">
        <p className="text-sm text-neutral-700">Invalid deck id.</p>
      </div>
    );
  }

  return <StudyPageClient deckId={deckId} tag={tag} />;
}
