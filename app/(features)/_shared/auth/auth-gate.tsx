"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { getSupabaseBrowser } from "@/lib/supabase-browser"
import { PageLoading } from "@shared/ui/loading"

export default function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [ready, setReady] = useState(false)

  const redirectToSignup = () => {
    const query = searchParams.toString()
    const nextPath = query ? `${pathname}?${query}` : pathname
    router.replace(`/signup?next=${encodeURIComponent(nextPath)}`)
  }

  useEffect(() => {
    try {
      const supabase = getSupabaseBrowser()

      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) {
          redirectToSignup()
          return
        }
        setReady(true)
      })

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session) {
          redirectToSignup()
          return
        }
        setReady(true)
      })

      return () => {
        data.subscription.unsubscribe()
      }
    } catch {
      redirectToSignup()
    }
  }, [pathname, router, searchParams])

  if (!ready) {
    return <PageLoading />
  }

  return <>{children}</>
}
