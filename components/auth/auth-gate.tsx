"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseBrowser } from "@/lib/supabase-browser"
import { PageLoading } from "@/components/ui/loading"

export default function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const supabase = getSupabaseBrowser()

      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) {
          router.replace("/signup")
          return
        }
        setReady(true)
      })

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session) {
          router.replace("/signup")
          return
        }
        setReady(true)
      })

      return () => {
        data.subscription.unsubscribe()
      }
    } catch {
      router.replace("/signup")
    }
  }, [router])

  if (!ready) {
    return <PageLoading />
  }

  return <>{children}</>
}
