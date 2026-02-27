"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getSupabaseBrowser } from "@/lib/supabase-browser"
import { LoadingDots } from "@/components/ui/loading"
import { useI18n } from "@/components/i18n/i18n-provider"


export default function SignUpPage() {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const nextParam = searchParams.get("next") ?? "/library"
  const safeNextPath = nextParam.startsWith("/") ? nextParam : "/library"

  const handleSignUp = async () => {
    if (!email.trim() || !password) {
      setError(t("signup.error.missingCredentials", "Enter email and password."))
      return
    }

    setPending(true)
    setError(null)
    setNotice(null)
    try {
      const supabase = getSupabaseBrowser()
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}${safeNextPath}` : undefined
        }
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      setNotice(t("signup.notice.checkEmail", "Signup request sent. Verify email, then login."))
    } catch (error) {
      setError(error instanceof Error ? error.message : "Signup failed")
    } finally {
      setPending(false)
    }
  }

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError(t("signup.error.missingCredentials", "Enter email and password."))
      return
    }

    setPending(true)
    setError(null)
    setNotice(null)
    try {
      const supabase = getSupabaseBrowser()
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })

      if (loginError) {
        setError(loginError.message)
        return
      }

      router.replace(safeNextPath)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Login failed")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="min-h-screen p-6 bg-background font-sans selection:bg-accent selection:text-white">
      <main className="max-w-xl mx-auto animate-fade-in-up py-24">
        <header className="mb-8 border-b-4 border-foreground pb-4">
          <h1 className="font-black text-5xl uppercase text-foreground leading-none">{t("signup.title", "AUTH REQUIRED")}</h1>
          <p className="font-mono text-xs font-bold uppercase mt-3 text-muted-foreground">
            {t("signup.desc", "This page requires sign in.")}
          </p>
        </header>

        <section className="border-4 border-foreground bg-card p-6 space-y-4">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("signup.email", "email")}
            className="w-full bg-background border-2 border-foreground text-foreground p-3 font-mono text-sm"
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder={t("signup.password", "password")}
            className="w-full bg-background border-2 border-foreground text-foreground p-3 font-mono text-sm"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSignUp}
              disabled={pending}
              className="px-3 py-2 border-2 border-foreground font-mono text-xs font-bold uppercase bg-background text-foreground"
            >
              {pending ? <LoadingDots /> : t("signup.signup", "Signup")}
            </button>
            <button
              type="button"
              onClick={handleLogin}
              disabled={pending}
              className="px-3 py-2 border-2 border-foreground font-mono text-xs font-bold uppercase bg-foreground text-background"
            >
              {pending ? <LoadingDots /> : t("signup.login", "Login")}
            </button>
            <Link
              href="/"
              className="px-3 py-2 border-2 border-foreground font-mono text-xs font-bold uppercase bg-background text-foreground"
            >
              {t("signup.home", "Home")}
            </Link>
          </div>

          {error ? <p className="font-mono text-xs text-destructive">{error}</p> : null}
          {notice ? <p className="font-mono text-xs text-foreground">{notice}</p> : null}
        </section>
      </main>
    </div>
  )
}
