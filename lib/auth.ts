import { z } from "zod"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const UserIdSchema = z.string().uuid()

export async function getUserId(headers: Headers): Promise<string | null> {
  const authHeader = headers.get("authorization")

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim()

    if (token.length > 0) {
      const supabase = getSupabaseAdmin()
      const { data, error } = await supabase.auth.getUser(token)

      if (!error && data.user?.id) {
        return data.user.id
      }
    }
  }

  const headerUserId = headers.get("x-user-id")
  const fallbackUserId = process.env.REBAR_DEV_USER_ID ?? null
  const userId = headerUserId ?? fallbackUserId

  if (!userId) {
    return null
  }

  const parsed = UserIdSchema.safeParse(userId)
  if (!parsed.success) {
    return null
  }

  return parsed.data
}
