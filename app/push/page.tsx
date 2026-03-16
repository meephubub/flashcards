import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import PushSender from '@/components/push-sender'
import { Bell } from 'lucide-react'

const ALLOWED_EMAIL = 'samthelegend68@gmail.com'

export default async function PushPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUB_API!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ALLOWED_EMAIL) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-foreground rounded-lg">
              <Bell className="w-5 h-5 text-background" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {user.email}
          </p>
        </div>
        
        {/* Main Card */}
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
          <PushSender />
        </div>
      </div>
    </div>
  )
}
