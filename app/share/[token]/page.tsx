import { SharedStudyPageClient } from "@/components/shared-study-page-client";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SharedStudyPageClient token={token} />;
}

