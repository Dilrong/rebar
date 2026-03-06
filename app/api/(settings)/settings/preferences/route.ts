import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { fail, internalError, ok, rateLimited } from "@/lib/http"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { parseStartPage, parseFontFamily, type StartPage, type FontFamily } from "@feature-lib/settings/preferences"

const UpdatePreferencesSchema = z.object({
  startPage: z.enum(["/review", "/capture", "/library", "/search"]).optional(),
  fontFamily: z.enum(["sans", "mono"]).optional()
}).refine((value) => value.startPage !== undefined || value.fontFamily !== undefined, {
  message: "At least one preference is required"
})

const DEFAULT_START_PAGE: StartPage = "/library"
const DEFAULT_FONT_FAMILY: FontFamily = "sans"

function isMissingPreferencesTableError(error: { code?: string | null; message?: string | null } | null | undefined) {
  return error?.code === "PGRST205" && error.message?.includes("user_preferences")
}

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
    .select("start_page, font_family")
    .eq("user_id", userId)
    .maybeSingle()

  if (result.error) {
    if (isMissingPreferencesTableError(result.error)) {
      return ok({ startPage: DEFAULT_START_PAGE, fontFamily: DEFAULT_FONT_FAMILY })
    }
    return internalError("settings", result.error)
  }

  const startPage = parseStartPage(result.data?.start_page) ?? DEFAULT_START_PAGE
  const fontFamily = parseFontFamily(result.data?.font_family) ?? DEFAULT_FONT_FAMILY

  return ok({ startPage, fontFamily })
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

  // First get existing preferences to merge
  const existingResult = await supabase
    .from("user_preferences")
    .select("start_page, font_family")
    .eq("user_id", userId)
    .maybeSingle()

  let startPageToSave = parsed.data.startPage
  let fontFamilyToSave = parsed.data.fontFamily

  if (existingResult?.error) {
    if (isMissingPreferencesTableError(existingResult.error)) {
      return ok({
        startPage: startPageToSave ?? DEFAULT_START_PAGE,
        fontFamily: fontFamilyToSave ?? DEFAULT_FONT_FAMILY
      })
    }
    return internalError("settings", existingResult.error)
  }

  const existingData = existingResult?.data
  if (existingData) {
    if (startPageToSave === undefined) startPageToSave = parseStartPage(existingData.start_page) ?? DEFAULT_START_PAGE
    if (fontFamilyToSave === undefined) fontFamilyToSave = parseFontFamily(existingData.font_family) ?? DEFAULT_FONT_FAMILY
  }

  const result = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: userId,
        start_page: startPageToSave ?? DEFAULT_START_PAGE,
        font_family: fontFamilyToSave ?? DEFAULT_FONT_FAMILY
      },
      { onConflict: "user_id" }
    )
    .select("start_page, font_family")
    .single()

  if (result.error) {
    return internalError("settings", result.error)
  }

  const nextStartPage = parseStartPage(result.data?.start_page) ?? startPageToSave ?? DEFAULT_START_PAGE
  const nextFontFamily = parseFontFamily(result.data?.font_family) ?? fontFamilyToSave ?? DEFAULT_FONT_FAMILY

  return ok({
    startPage: nextStartPage,
    fontFamily: nextFontFamily
  })
}
