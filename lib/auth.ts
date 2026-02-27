import { timingSafeEqual } from "node:crypto"
import { z } from "zod"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const UserIdSchema = z.string().uuid()

export async function getUserId(headers: Headers): Promise<string | null> {
  const authHeader = headers.get("authorization") ?? ""

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
