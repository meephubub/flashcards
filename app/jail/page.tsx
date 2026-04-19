import Link from "next/link";

export default function JailPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-black p-6 text-center select-none">
      <div className="max-w-sm w-full space-y-12">
        {/* Icon — simple lock glyph */}
        <div className="flex justify-center">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-zinc-300 dark:text-zinc-700"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        {/* Copy */}
        <div className="space-y-3">
          <h1 className="text-lg font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
            Cookies required
          </h1>
          <p className="text-sm leading-relaxed text-zinc-400 dark:text-zinc-500">
            We need your consent to use essential cookies before you can continue.
            Without them the app cannot function properly.
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/"
          className="inline-flex items-center justify-center w-full h-10 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
        >
          Go back &amp; accept
        </Link>

        <p className="text-[10px] text-zinc-300 dark:text-zinc-800 uppercase tracking-[0.2em]">
          yasashi
        </p>
      </div>
    </div>
  );
}
