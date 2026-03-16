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
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6">
      <div className="max-w-lg mx-auto">
        <div className="mb-6 px-6">
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {user.email}
          </p>
        </div>

        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <PushSender />
        </div>
      </div>
    </div>
  )
}

