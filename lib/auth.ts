import { z } from "zod"
import { safeEqual } from "@/lib/crypto"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { isLocalRequestHost } from "@/lib/security/localhost"
import { isAllowedOrigin } from "@/lib/security/origin"

const UserIdSchema = z.string().uuid()

export function isValidOrigin(headers: Headers): boolean {
  const origin = headers.get("origin")
  const host = headers.get("host")
  return isAllowedOrigin(origin, host)
}

type GetUserIdOptions = {
  allowIngestKey?: boolean
}

export async function getUserId(headers: Headers, options: GetUserIdOptions = {}): Promise<string | null> {
  const authHeader = headers.get("authorization") ?? ""

  // Path 1: Bearer token (web app, explicit token)
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim()

    if (token.length > 0) {
      try {
        const supabase = getSupabaseAdmin()
        const { data, error } = await supabase.auth.getUser(token)

        if (!error && data.user?.id) {
          return data.user.id
        }
      } catch {
        // Token validation failed (network error, malformed token, etc.)
      }

      return null
    }
  }

  // Path 2: API key (external ingest, cron)
  const ingestKey = headers.get("x-rebar-ingest-key")
  const expectedKey = process.env.REBAR_INGEST_API_KEY
  const headerUserId = headers.get("x-user-id")

  if (options.allowIngestKey && ingestKey && expectedKey && headerUserId) {
    const parsedHeaderUserId = UserIdSchema.safeParse(headerUserId)
    if (!parsedHeaderUserId.success) {
      return null
    }

    if (safeEqual(ingestKey, expectedKey)) {
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

  if (process.env.REBAR_E2E_BYPASS_AUTH === "true") {
    // Only check the host header — x-forwarded-host can be spoofed by clients
    const hostHeader = headers.get("host")
    const isLocalHost = hostHeader !== null && isLocalRequestHost(hostHeader)

    if (isLocalHost) {
      const parsedE2EUser = UserIdSchema.safeParse(process.env.REBAR_E2E_TEST_USER_ID)
      if (parsedE2EUser.success) {
        return parsedE2EUser.data
      }
    }
  }

  return null
}
