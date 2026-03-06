import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { PGRST_NOT_FOUND } from "@/lib/constants"
import { fail, internalError, ok, rateLimited } from "@/lib/http"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { generateRecordAssist } from "@feature-lib/content/assist"

const ParamsSchema = z.object({ id: z.string().uuid() })

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limitResult = await checkRateLimitDistributed({
    key: `records:assist:${resolveClientKey(request.headers)}`,
    limit: 40,
    windowMs: 60_000
  })
  if (!limitResult.ok) {
    return rateLimited(limitResult.retryAfterSec)
  }

  const userId = await getUserId(request.headers)
  if (!userId) {
    return fail("Unauthorized", 401)
  }

  const params = await context.params
  const parsed = ParamsSchema.safeParse(params)
  if (!parsed.success) {
    return fail("Invalid id", 400)
  }

  const supabase = getSupabaseAdmin()
  const recordResult = await supabase
    .from("records")
    .select("id,content,source_title")
    .eq("id", parsed.data.id)
    .eq("user_id", userId)
    .single()

  if (recordResult.error) {
    if (recordResult.error.code === PGRST_NOT_FOUND) {
      return fail("Record not found", 404)
    }
    return internalError("assist.get", recordResult.error)
  }

  const [annotationsResult, tagLinksResult] = await Promise.all([
    supabase
      .from("annotations")
      .select("body")
      .eq("record_id", parsed.data.id)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("record_tags")
      .select("tag_id")
      .eq("record_id", parsed.data.id)
  ])

  if (annotationsResult.error) {
    return internalError("assist.get", annotationsResult.error)
  }

  if (tagLinksResult.error) {
    return internalError("assist.get", tagLinksResult.error)
  }

  const tagIds = tagLinksResult.data.map((row) => row.tag_id)
  let tags: string[] = []

  if (tagIds.length > 0) {
    const tagsResult = await supabase
      .from("tags")
      .select("name")
      .eq("user_id", userId)
      .in("id", tagIds)

    if (tagsResult.error) {
      return internalError("assist.get", tagsResult.error)
    }

    tags = tagsResult.data.map((tag) => tag.name)
  }

  const assist = generateRecordAssist({
    content: recordResult.data.content,
    sourceTitle: recordResult.data.source_title,
    annotations: annotationsResult.data.map((row) => row.body),
    tags
  })

  return ok({ data: assist })
}
