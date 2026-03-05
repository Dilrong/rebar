import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { fail, ok, rateLimited } from "@/lib/http"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const BodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  tag_ids: z.array(z.string().uuid()).max(100),
  mode: z.enum(["add", "replace"]).default("add")
})

export async function POST(request: NextRequest) {
  const limitResult = await checkRateLimitDistributed({
    key: `records:bulk:tags:post:${resolveClientKey(request.headers)}`,
    limit: 30,
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
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 400)
  }

  const ids = Array.from(new Set(parsed.data.ids))
  const tagIds = Array.from(new Set(parsed.data.tag_ids))
  const supabase = getSupabaseAdmin()

  const records = await supabase.from("records").select("id").eq("user_id", userId).in("id", ids)
  if (records.error) {
    return fail(records.error.message, 500)
  }

  const existingIds = new Set(records.data.map((row) => row.id))
  const targetIds = ids.filter((id) => existingIds.has(id))

  if (tagIds.length > 0) {
    const ownedTags = await supabase.from("tags").select("id").eq("user_id", userId).in("id", tagIds)
    if (ownedTags.error) {
      return fail(ownedTags.error.message, 500)
    }

    const ownedTagIds = new Set(ownedTags.data.map((row) => row.id))
    const invalidTagIds = tagIds.filter((tagId) => !ownedTagIds.has(tagId))
    if (invalidTagIds.length > 0) {
      return fail("Invalid tag_ids", 400)
    }
  }

  if (targetIds.length === 0) {
    return ok({ requested: ids.length, processed: 0, mode: parsed.data.mode })
  }

  if (parsed.data.mode === "replace") {
    if (tagIds.length === 0) {
      const deletedAll = await supabase.from("record_tags").delete().in("record_id", targetIds)
      if (deletedAll.error) {
        return fail(deletedAll.error.message, 500)
      }
    } else {
      const links: Array<{ record_id: string; tag_id: string }> = []
      for (const recordId of targetIds) {
        for (const tagId of tagIds) {
          links.push({ record_id: recordId, tag_id: tagId })
        }
      }

      const upserted = await supabase.from("record_tags").upsert(links, { onConflict: "record_id,tag_id" })
      if (upserted.error) {
        return fail(upserted.error.message, 500)
      }

      const tagIdSet = new Set(tagIds)
      const existingLinks = await supabase.from("record_tags").select("record_id, tag_id").in("record_id", targetIds)
      if (existingLinks.error) {
        return fail(existingLinks.error.message, 500)
      }
      const staleLinks = existingLinks.data.filter((r) => !tagIdSet.has(r.tag_id))
      if (staleLinks.length > 0) {
        const staleTagIds = [...new Set(staleLinks.map((r) => r.tag_id))]
        const removed = await supabase.from("record_tags").delete().in("record_id", targetIds).in("tag_id", staleTagIds)
        if (removed.error) {
          return fail(removed.error.message, 500)
        }
      }
    }
  } else if (tagIds.length > 0) {
    const links: Array<{ record_id: string; tag_id: string }> = []
    for (const recordId of targetIds) {
      for (const tagId of tagIds) {
        links.push({ record_id: recordId, tag_id: tagId })
      }
    }

    const upserted = await supabase.from("record_tags").upsert(links, { onConflict: "record_id,tag_id" })
    if (upserted.error) {
      return fail(upserted.error.message, 500)
    }
  }

  return ok({
    requested: ids.length,
    processed: targetIds.length,
    mode: parsed.data.mode,
    tag_count: tagIds.length
  })
}
