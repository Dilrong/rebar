import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { PGRST_NOT_FOUND } from "@/lib/constants"
import { fail, internalError, ok, rateLimited } from "@/lib/http"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { sendRecordStateChangedEvent } from "@feature-lib/notifications/webhooks"
import { getInvalidOwnedTagIds } from "@/lib/record-tags"
import { isValidStateTransition, UpdateRecordSchema } from "@/lib/schemas"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import type { RecordRow } from "@/lib/types"

const ParamsSchema = z.object({ id: z.string().uuid() })

function resolveFaviconUrl(url: string | null): string | null {
  if (!url) {
    return null
  }

  try {
    const { hostname } = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limitResult = await checkRateLimitDistributed({
    key: `records:id:get:${resolveClientKey(request.headers)}`,
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

  const params = await context.params
  const parsed = ParamsSchema.safeParse(params)
  if (!parsed.success) {
    return fail("Invalid id", 400)
  }

  const supabase = getSupabaseAdmin()
  const recordResult = await supabase
    .from("records")
    .select("*")
    .eq("id", parsed.data.id)
    .eq("user_id", userId)
    .single()

  if (recordResult.error) {
    if (recordResult.error.code === PGRST_NOT_FOUND) {
      return fail("Record not found", 404)
    }

    return internalError("record.get", recordResult.error)
  }

  const [annotationsResult, linksResult, noteVersionsResult] = await Promise.all([
    supabase
      .from("annotations")
      .select("*")
      .eq("record_id", parsed.data.id)
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase.from("record_tags").select("tag_id").eq("record_id", parsed.data.id),
    supabase
      .from("record_note_versions")
      .select("*")
      .eq("record_id", parsed.data.id)
      .eq("user_id", userId)
      .order("replaced_at", { ascending: false })
  ])

  if (annotationsResult.error) {
    return internalError("record.get", annotationsResult.error)
  }

  if (linksResult.error) {
    return internalError("record.get", linksResult.error)
  }

  if (noteVersionsResult.error) {
    return internalError("record.get", noteVersionsResult.error)
  }

  const tagIds = linksResult.data.map((item) => item.tag_id)
  let tags: { id: string; name: string }[] = []

  if (tagIds.length > 0) {
    const tagsResult = await supabase
      .from("tags")
      .select("id, name")
      .eq("user_id", userId)
      .in("id", tagIds)
      .order("name", { ascending: true })

    if (tagsResult.error) {
      return internalError("record.get", tagsResult.error)
    }

    tags = tagsResult.data
  }

  return ok({
    record: recordResult.data,
    annotations: annotationsResult.data,
    note_versions: noteVersionsResult.data,
    tags
  })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limitResult = await checkRateLimitDistributed({
    key: `records:id:patch:${resolveClientKey(request.headers)}`,
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

  const params = await context.params
  const parsedParams = ParamsSchema.safeParse(params)
  if (!parsedParams.success) {
    return fail("Invalid id", 400)
  }

  const body = await request.json().catch(() => null)
  const parsedBody = UpdateRecordSchema.safeParse(body)
  if (!parsedBody.success) {
    return fail(parsedBody.error.issues[0]?.message ?? "Invalid payload", 400)
  }

  const supabase = getSupabaseAdmin()
  const existing = await supabase
    .from("records")
    .select("id, state, source_id, url, source_title")
    .eq("id", parsedParams.data.id)
    .eq("user_id", userId)
    .single()

  if (existing.error) {
    if (existing.error.code === PGRST_NOT_FOUND) {
      return fail("Record not found", 404)
    }

    return internalError("record.patch", existing.error)
  }

  if (
    parsedBody.data.state &&
    !isValidStateTransition(existing.data.state, parsedBody.data.state)
  ) {
    return fail("Invalid state transition", 400)
  }

  const shouldUpdateTags = Object.prototype.hasOwnProperty.call(parsedBody.data, "tag_ids")
  const nextTagIds = shouldUpdateTags ? Array.from(new Set(parsedBody.data.tag_ids ?? [])) : []

  if (shouldUpdateTags && nextTagIds.length > 0) {
    const validation = await getInvalidOwnedTagIds(supabase, userId, nextTagIds)
    if (validation.error) {
      return internalError("record.patch", validation.error)
    }

    if (validation.invalidTagIds.length > 0) {
      return fail("Invalid tag_ids", 400)
    }
  }

  const shouldUpdateUrl = Object.prototype.hasOwnProperty.call(parsedBody.data, "url")
  const shouldUpdateSourceTitle = Object.prototype.hasOwnProperty.call(parsedBody.data, "source_title")
  const nextUrl = shouldUpdateUrl ? parsedBody.data.url ?? null : existing.data.url ?? null
  const nextSourceTitle = shouldUpdateSourceTitle ? parsedBody.data.source_title ?? null : existing.data.source_title ?? null

  const updated = await supabase
    .rpc("update_record_with_tags", {
      p_user_id: userId,
      p_record_id: parsedParams.data.id,
      p_update_state: Boolean(parsedBody.data.state),
      p_state: parsedBody.data.state ?? null,
      p_update_url: shouldUpdateUrl,
      p_url: shouldUpdateUrl ? nextUrl : null,
      p_update_source_title: shouldUpdateSourceTitle,
      p_source_title: shouldUpdateSourceTitle ? nextSourceTitle : null,
      p_update_tags: shouldUpdateTags,
      p_tag_ids: nextTagIds
    })
    .single()

  if (updated.error) {
    if (updated.error.code === "P0002") {
      return fail("Record not found", 404)
    }

    return internalError("record.patch", updated.error)
  }

  if (existing.data.source_id && (shouldUpdateUrl || shouldUpdateSourceTitle)) {
    const updatedSource = await supabase
      .from("sources")
      .update({
        url: nextUrl,
        title: nextSourceTitle
      })
      .eq("id", existing.data.source_id)
      .eq("user_id", userId)

    if (updatedSource.error) {
      return internalError("record.patch", updatedSource.error)
    }

    const propagated = await supabase
      .from("records")
      .update({
        url: nextUrl,
        source_title: nextSourceTitle,
        favicon_url: resolveFaviconUrl(nextUrl)
      })
      .eq("user_id", userId)
      .eq("source_id", existing.data.source_id)

    if (propagated.error) {
      return internalError("record.patch", propagated.error)
    }

    const refreshed = await supabase
      .from("records")
      .select("*")
      .eq("id", parsedParams.data.id)
      .eq("user_id", userId)
      .single()

    if (refreshed.error) {
      return internalError("record.patch", refreshed.error)
    }

    if (existing.data.state !== refreshed.data.state) {
      const webhookResult = await sendRecordStateChangedEvent({
        userId,
        recordId: parsedParams.data.id,
        previousState: existing.data.state,
        nextState: refreshed.data.state,
        source: "record.patch"
      })

      if (!webhookResult.ok) {
        console.error("[record.patch] webhook dispatch failed:", webhookResult.error)
      }
    }

    return ok({ record: refreshed.data as RecordRow })
  }

  if (existing.data.state !== updated.data.state) {
    const webhookResult = await sendRecordStateChangedEvent({
      userId,
      recordId: parsedParams.data.id,
      previousState: existing.data.state,
      nextState: updated.data.state,
      source: "record.patch"
    })

    if (!webhookResult.ok) {
      console.error("[record.patch] webhook dispatch failed:", webhookResult.error)
    }
  }

  return ok({ record: updated.data as RecordRow })
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limitResult = await checkRateLimitDistributed({
    key: `records:id:delete:${resolveClientKey(request.headers)}`,
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
  const existing = await supabase
    .from("records")
    .select("id, state")
    .eq("id", parsed.data.id)
    .eq("user_id", userId)
    .single()

  if (existing.error) {
    if (existing.error.code === PGRST_NOT_FOUND) {
      return fail("Record not found", 404)
    }

    return internalError("record.delete", existing.error)
  }

  const deleted = await supabase
    .from("records")
    .update({ state: "TRASHED", updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("user_id", userId)
    .select("*")
    .single()

  if (deleted.error) {
    if (deleted.error.code === PGRST_NOT_FOUND) {
      return fail("Record not found", 404)
    }

    return internalError("record.delete", deleted.error)
  }

  if (existing.data.state !== deleted.data.state) {
    const webhookResult = await sendRecordStateChangedEvent({
      userId,
      recordId: parsed.data.id,
      previousState: existing.data.state,
      nextState: deleted.data.state,
      source: "record.patch"
    })

    if (!webhookResult.ok) {
      console.error("[record.delete] webhook dispatch failed:", webhookResult.error)
    }
  }

  return ok({ record: deleted.data })
}
