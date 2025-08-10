import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Install Flashcard App",
  description: "Install the Flashcard App to your Home Screen for a better experience.",
  icons: [
    { url: "/IMG_2251.png", sizes: "192x192", type: "image/png" },
    { url: "/favicon.png", sizes: "512x512", type: "image/png" },
    { url: "/IMG_2253.png", sizes: "180x180", type: "image/png", rel: "apple-touch-icon" },
  ],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Flashcard App",
  },
};

export default function InstallPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 560, width: '100%', background: '#fff', color: '#111', border: '1px solid rgba(0,0,0,.08)', borderRadius: 16, padding: 20, boxShadow: '0 8px 30px rgba(0,0,0,.06)' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 22 }}>Install Flashcard App</h1>
        <p style={{ margin: '0 0 12px', color: '#444' }}>
          Add this app to your Home Screen for a faster, fullscreen experience and basic offline support.
        </p>
        <ol style={{ margin: '0 0 12px 18px', color: '#333', lineHeight: 1.5 }}>
          <li>Tap the <strong>Share</strong> button in Safari.</li>
          <li>Choose <strong>Add to Home Screen</strong>.</li>
          <li>Tap <strong>Add</strong>.</li>
        </ol>
        <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
          If the Add button is disabled, refresh this page and try again. Ensure you opened this page directly in Safari.
        </p>
      </div>
    </main>
  );
}
