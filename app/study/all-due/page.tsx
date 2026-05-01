import { Suspense } from "react";
import { AllDueStudyPageClient } from "@/components/all-due-study-page-client";

export default function AllDueStudyPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-white text-black"><div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div></div>}>
      <AllDueStudyPageClient />
    </Suspense>
  );
}
