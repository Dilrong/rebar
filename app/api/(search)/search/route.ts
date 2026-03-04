import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { fail, ok, rateLimited } from "@/lib/http"
import { decodeTimestampCursor, encodeTimestampCursor } from "@/lib/pagination"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { RecordStateSchema } from "@/lib/schemas"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const UuidSchema = z.string().uuid()
const MAX_SEMANTIC_CANDIDATES = 200
const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "on",
  "with",
  "is",
  "are",
  "this",
  "that",
  "it",
  "as",
  "by",
  "from",
  "be",
  "at",
  "we",
  "you",
  "i",
  "나",
  "너",
  "저",
  "그",
  "이",
  "및",
  "그리고",
  "또는",
  "에서",
  "으로",
  "하다",
  "하는",
  "했다",
  "합니다"
])

type SemanticRow = {
  id: string
  content: string
  source_title: string | null
  created_at: string
  [key: string]: unknown
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
}

function semanticScore(row: SemanticRow, query: string): { score: number; matches: string[] } {
  const tokens = tokenize(query)
  if (tokens.length === 0) {
    return { score: 0, matches: [] }
  }

  const content = normalizeText(row.content)
  const source = normalizeText(row.source_title ?? "")
  const phrase = normalizeText(query)
  let score = 0
  const matches = new Set<string>()

  for (const token of tokens) {
    let tokenScore = 0

    if (source.includes(token)) {
      tokenScore += 4
    }
    if (content.includes(token)) {
      tokenScore += 3
    }
    if (` ${content} `.includes(` ${token} `)) {
      tokenScore += 1
    }

    if (tokenScore > 0) {
      matches.add(token)
      score += tokenScore
    }
  }

  if (phrase.length >= 4) {
    if (content.includes(phrase)) {
      score += 6
    }
    if (source.includes(phrase)) {
      score += 6
    }
  }

  const createdMs = new Date(row.created_at).getTime()
  if (!Number.isNaN(createdMs)) {
    const ageDays = (Date.now() - createdMs) / 86_400_000
    score += Math.max(0, 2 - ageDays / 30)
  }

  return { score: Number(score.toFixed(2)), matches: Array.from(matches) }
}

export async function GET(request: NextRequest) {
  const limitResult = await checkRateLimitDistributed({
    key: `search:get:${resolveClientKey(request.headers)}`,
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

  const params = request.nextUrl.searchParams
  const q = params.get("q")?.trim() ?? ""
  const state = params.get("state")?.trim() ?? ""
  const tagId = params.get("tag_id")?.trim() ?? ""
  const fromDate = params.get("from")?.trim() ?? ""
  const toDate = params.get("to")?.trim() ?? ""
  const semanticParam = params.get("semantic")?.trim() ?? "0"
  const semanticEnabled = semanticParam === "1" || semanticParam.toLowerCase() === "true"
  const limit = Math.min(Number(params.get("limit") ?? "50") || 50, 100)
  const cursorParam = params.get("cursor")
  const cursorTs = cursorParam ? decodeTimestampCursor(cursorParam) : null
  let validState: z.infer<typeof RecordStateSchema> | undefined

  if (!q && !state && !tagId && !fromDate && !toDate) {
    return fail("At least one filter is required", 400)
  }

  if (cursorParam && !cursorTs) {
    return fail("Invalid cursor", 400)
  }

  if (state) {
    const parsedState = RecordStateSchema.safeParse(state)
    if (!parsedState.success) {
      return fail("Invalid state", 400)
    }

    validState = parsedState.data
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
    const ownedTag = await supabase
      .from("tags")
      .select("id")
      .eq("id", tagId)
      .eq("user_id", userId)
      .maybeSingle()

    if (ownedTag.error) {
      return fail(ownedTag.error.message, 500)
    }

    if (!ownedTag.data) {
      return ok({ data: [] })
    }

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
    .limit(limit)

  if (validState) {
    query = query.eq("state", validState)
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

  if (cursorTs) {
    query = query.lt("created_at", cursorTs)
  }

  const runQuery = async (useTextSearch: boolean) => {
    let runnable = query

    if (q) {
      if (useTextSearch) {
        runnable = runnable.textSearch("fts", q, { type: "plain", config: "simple" })
      } else {
        const escaped = q.replace(/[\\%_]/g, "\\$&").replace(/[,]/g, "")
        runnable = runnable.or(`content.ilike.%${escaped}%,source_title.ilike.%${escaped}%`)
      }
    }

    return runnable
  }

  if (semanticEnabled) {
    const candidateLimit = Math.min(MAX_SEMANTIC_CANDIDATES, Math.max(limit * 8, limit))
    const runSemanticCandidates = async (useTextSearch: boolean) => {
      let runnable = query.limit(candidateLimit)

      if (q) {
        if (useTextSearch) {
          runnable = runnable.textSearch("fts", q, { type: "plain", config: "simple" })
        } else {
          const escaped = q.replace(/[\\%_]/g, "\\$&").replace(/[,]/g, "")
          runnable = runnable.or(`content.ilike.%${escaped}%,source_title.ilike.%${escaped}%`)
        }
      }

      return runnable
    }

    let candidateResult = await runSemanticCandidates(true)
    if (q && candidateResult.error && /fts|textSearch|column/i.test(candidateResult.error.message)) {
      candidateResult = await runSemanticCandidates(false)
    }

    if (candidateResult.error) {
      return fail(candidateResult.error.message, 500)
    }

    const candidates = (candidateResult.data ?? []) as SemanticRow[]
    const scored = candidates
      .map((row) => {
        const semantic = semanticScore(row, q)
        return {
          ...row,
          semantic_score: semantic.score,
          semantic_matches: semantic.matches
        }
      })
      .sort((a, b) => {
        if (b.semantic_score !== a.semantic_score) {
          return b.semantic_score - a.semantic_score
        }
        return a.created_at > b.created_at ? -1 : 1
      })

    const rows = scored.slice(0, limit)
    const nextCursor = rows.length === limit ? encodeTimestampCursor(rows[rows.length - 1].created_at) : null
    return ok({ data: rows, next_cursor: nextCursor, semantic: true })
  }

  let result = await runQuery(true)
  if (q && result.error && /fts|textSearch|column/i.test(result.error.message)) {
    result = await runQuery(false)
  }

  if (result.error) {
    return fail(result.error.message, 500)
  }

  const rows = result.data ?? []
  const nextCursor = rows.length === limit ? encodeTimestampCursor(rows[rows.length - 1].created_at) : null

  return ok({ data: rows, next_cursor: nextCursor })
}
