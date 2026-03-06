import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { fail, internalError, ok, rateLimited } from "@/lib/http"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const ToolCallSchema = z.object({
  method: z.enum(["tools/list", "tools/call"]),
  params: z.record(z.string(), z.unknown()).optional()
})

const GetRecordInput = z.object({ id: z.string().uuid() })
const ListRecordsInput = z.object({ limit: z.number().int().min(1).max(100).optional() })
const SearchInput = z.object({ q: z.string().min(1), limit: z.number().int().min(1).max(100).optional() })

function toolList() {
  return [
    {
      name: "records.list",
      description: "List latest records for authenticated user",
      input_schema: { type: "object", properties: { limit: { type: "number" } } }
    },
    {
      name: "records.get",
      description: "Get one record by id",
      input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }
    },
    {
      name: "records.search",
      description: "Search records by query text",
      input_schema: {
        type: "object",
        properties: { q: { type: "string" }, limit: { type: "number" } },
        required: ["q"]
      }
    }
  ]
}

export async function GET(request: Request) {
  const limitResult = await checkRateLimitDistributed({
    key: `mcp:get:${resolveClientKey(request.headers)}`,
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

  return ok({ server: "rebar-mcp", version: "0.1.0", read_only: true, tools: toolList() })
}

export async function POST(request: Request) {
  const limitResult = await checkRateLimitDistributed({
    key: `mcp:post:${resolveClientKey(request.headers)}`,
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

  const body = await request.json().catch(() => null)
  const parsed = ToolCallSchema.safeParse(body)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 400)
  }

  if (parsed.data.method === "tools/list") {
    return ok({ tools: toolList() })
  }

  const params = parsed.data.params ?? {}
  const toolName = typeof params.name === "string" ? params.name : ""
  const input = (params.input ?? {}) as Record<string, unknown>
  const supabase = getSupabaseAdmin()

  if (toolName === "records.list") {
    const p = ListRecordsInput.safeParse(input)
    if (!p.success) {
      return fail(p.error.issues[0]?.message ?? "Invalid input", 400)
    }

    const result = await supabase
      .from("records")
      .select("id,kind,state,source_title,content,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(p.data.limit ?? 20)

    if (result.error) {
      return internalError("mcp", result.error)
    }

    return ok({ content: result.data })
  }

  if (toolName === "records.get") {
    const p = GetRecordInput.safeParse(input)
    if (!p.success) {
      return fail(p.error.issues[0]?.message ?? "Invalid input", 400)
    }

    const result = await supabase
      .from("records")
      .select("*")
      .eq("user_id", userId)
      .eq("id", p.data.id)
      .single()
    if (result.error) {
      return internalError("mcp", result.error)
    }

    return ok({ content: result.data })
  }

  if (toolName === "records.search") {
    const p = SearchInput.safeParse(input)
    if (!p.success) {
      return fail(p.error.issues[0]?.message ?? "Invalid input", 400)
    }

    let query = supabase
      .from("records")
      .select("id,kind,state,source_title,content,created_at")
      .eq("user_id", userId)
      .neq("state", "TRASHED")
      .order("created_at", { ascending: false })
      .limit(p.data.limit ?? 20)

    query = query.textSearch("fts", p.data.q, { type: "plain", config: "simple" })
    let result = await query
    if (result.error && /fts|textSearch|column/i.test(result.error.message)) {
      const escaped = p.data.q.replace(/[\\%_]/g, "\\$&").replace(/[,]/g, "")
      result = await supabase
        .from("records")
        .select("id,kind,state,source_title,content,created_at")
        .eq("user_id", userId)
        .neq("state", "TRASHED")
        .or(`content.ilike.%${escaped}%,source_title.ilike.%${escaped}%`)
        .order("created_at", { ascending: false })
        .limit(p.data.limit ?? 20)
    }

    if (result.error) {
      return internalError("mcp", result.error)
    }

    return ok({ content: result.data })
  }

  return fail("Unknown tool name", 400)
}
