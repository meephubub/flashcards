import { Sidebar } from "@/components/sidebar"
import { SettingsContent } from "@/components/settings-content"

export default function SettingsPage() {
  return (
    <div className="flex h-screen bg-[#f5f5f7]">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <SettingsContent />
      </main>
    </div>
  )
}
