import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { fail, ok } from "@/lib/http"
import { RecordStateSchema } from "@/lib/schemas"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const UuidSchema = z.string().uuid()

export async function GET(request: NextRequest) {
  const userId = await getUserId(request.headers)
  if (!userId) {
    return fail("Unauthorized", 401)
  }

  const params = request.nextUrl.searchParams
  const q = params.get("q")?.trim() ?? ""
  const state = params.get("state")?.trim() ?? ""
  const tagId = params.get("tag_id")?.trim() ?? ""
  const fromDate = params.get("from")?.trim() ?? ""
  const toDate = params.get("to")?.trim() ?? ""

  if (!q && !state && !tagId && !fromDate && !toDate) {
    return fail("At least one filter is required", 400)
  }

  if (state) {
    const parsedState = RecordStateSchema.safeParse(state)
    if (!parsedState.success) {
      return fail("Invalid state", 400)
    }
  }

  if (tagId) {
    const parsedTag = UuidSchema.safeParse(tagId)
    if (!parsedTag.success) {
      return fail("Invalid tag_id", 400)
    }
  }

  const supabase = getSupabaseAdmin()
  let filteredRecordIds: string[] | null = null

  if (tagId) {
    const tagged = await supabase
      .from("record_tags")
      .select("record_id")
      .eq("tag_id", tagId)

    if (tagged.error) {
      return fail(tagged.error.message, 500)
    }

    filteredRecordIds = tagged.data.map((row) => row.record_id)
    if (filteredRecordIds.length === 0) {
      return ok({ data: [] })
    }
  }

  let query = supabase
    .from("records")
    .select("*")
    .eq("user_id", userId)
    .neq("state", "TRASHED")
    .order("created_at", { ascending: false })

  if (q) {
    const escaped = q.replace(/[,%]/g, "")
    query = query.or(`content.ilike.%${escaped}%,source_title.ilike.%${escaped}%`)
  }

  if (state) {
    query = query.eq("state", state)
  }

  if (fromDate) {
    query = query.gte("created_at", `${fromDate}T00:00:00.000Z`)
  }

  if (toDate) {
    query = query.lte("created_at", `${toDate}T23:59:59.999Z`)
  }

  if (filteredRecordIds) {
    query = query.in("id", filteredRecordIds)
  }

  const result = await query

  if (result.error) {
    return fail(result.error.message, 500)
  }

  return ok({ data: result.data })
}
