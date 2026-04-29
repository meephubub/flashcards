import { Suspense } from "react";
import { StudyTagsContent } from "./StudyTagsContent";

export default function StudyTagsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black">
        <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100 rounded-full animate-spin"></div>
      </div>
    }>
      <StudyTagsContent />
    </Suspense>
  );
}
