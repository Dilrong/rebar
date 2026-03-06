import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { fail, internalError, ok, rateLimited } from "@/lib/http"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { parseStartPage, type StartPage } from "@feature-lib/settings/preferences"

const UpdatePreferencesSchema = z.object({
  startPage: z.enum(["/review", "/capture", "/library", "/search"])
})

const DEFAULT_START_PAGE: StartPage = "/library"

export async function GET(request: NextRequest) {
  const limitResult = await checkRateLimitDistributed({
    key: `settings:preferences:get:${resolveClientKey(request.headers)}`,
    limit: 120,
    windowMs: 60_000
  })
  if (!limitResult.ok) {
    return rateLimited(limitResult.retryAfterSec)
  }

  const userId = await getUserId(request.headers)
  if (!userId) {
    return fail("Unauthorized", 401)
  }

  const supabase = getSupabaseAdmin()
  const result = await supabase
    .from("user_preferences")
    .select("start_page")
    .eq("user_id", userId)
    .maybeSingle()

  if (result.error) {
    return internalError("settings", result.error)
  }

  const startPage = parseStartPage(result.data?.start_page) ?? DEFAULT_START_PAGE
  return ok({ startPage })
}

export async function PATCH(request: NextRequest) {
  const limitResult = await checkRateLimitDistributed({
    key: `settings:preferences:patch:${resolveClientKey(request.headers)}`,
    limit: 60,
    windowMs: 60_000
  })
  if (!limitResult.ok) {
    return rateLimited(limitResult.retryAfterSec)
  }

  const userId = await getUserId(request.headers)
  if (!userId) {
    return fail("Unauthorized", 401)
  }

  const body = await request.json().catch(() => null)
  const parsed = UpdatePreferencesSchema.safeParse(body)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 400)
  }

  const supabase = getSupabaseAdmin()
  const result = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: userId,
        start_page: parsed.data.startPage
      },
      { onConflict: "user_id" }
    )
    .select("start_page")
    .single()

  if (result.error) {
    return internalError("settings", result.error)
  }

  return ok({ startPage: result.data.start_page })
}
