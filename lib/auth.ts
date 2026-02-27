import { timingSafeEqual } from "node:crypto"
import { z } from "zod"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const UserIdSchema = z.string().uuid()

const ALLOWED_ORIGINS: string[] = (() => {
  const origins: string[] = []
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (siteUrl) origins.push(siteUrl.replace(/\/+$/, ""))
  if (supabaseUrl) origins.push(supabaseUrl.replace(/\/+$/, ""))

  // Development origins
  if (process.env.NODE_ENV === "development") {
    origins.push("http://localhost:3000")
  }

  return origins
})()

export function isValidOrigin(headers: Headers): boolean {
  const origin = headers.get("origin")

  // No Origin header — same-origin request or non-browser client (API key etc.)
  if (!origin) return true

  // chrome-extension:// origins are always allowed (our extension)
  if (origin.startsWith("chrome-extension://")) return true

  return ALLOWED_ORIGINS.some((allowed) => origin === allowed)
}

export async function getUserId(headers: Headers): Promise<string | null> {
  const authHeader = headers.get("authorization") ?? ""

  // Path 1: Bearer token (web app, explicit token)
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim()

    if (token.length > 0) {
      const supabase = getSupabaseAdmin()
      const { data, error } = await supabase.auth.getUser(token)

      if (!error && data.user?.id) {
        return data.user.id
      }

      return null
    }
  }

  // Path 2: API key (external ingest, cron)
  const ingestKey = headers.get("x-rebar-ingest-key")
  const expectedKey = process.env.REBAR_INGEST_API_KEY
  const headerUserId = headers.get("x-user-id")

  if (ingestKey && expectedKey && headerUserId) {
    const parsedHeaderUserId = UserIdSchema.safeParse(headerUserId)
    if (!parsedHeaderUserId.success) {
      return null
    }

    const keyA = Buffer.from(ingestKey)
    const keyB = Buffer.from(expectedKey)
    if (keyA.length === keyB.length && timingSafeEqual(keyA, keyB)) {
      return parsedHeaderUserId.data
    }

    return null
  }

  // Path 3: Cookie-based session (Chrome extension, same-site browser)
  // Only attempt when no explicit Bearer token was provided
  try {
    const { getSupabaseServer } = await import("@/lib/supabase-server")
    const supabase = await getSupabaseServer()
    const { data, error } = await supabase.auth.getUser()

    if (!error && data.user?.id) {
      return data.user.id
    }
  } catch {
    // Not in a Route Handler context or cookies() unavailable — skip
  }

  // Path 4: Development fallback
  if (process.env.NODE_ENV === "development") {
    const devUserId = process.env.REBAR_DEV_USER_ID
    if (!devUserId) {
      return null
    }

    const parsedDev = UserIdSchema.safeParse(devUserId)
    if (!parsedDev.success) {
      return null
    }

    return parsedDev.data
  }

  return null
}
