import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { fail } from "@/lib/http"
import { RecordStateSchema } from "@/lib/schemas"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const UuidSchema = z.string().uuid()

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}\[\]()#+\-.!|>]/g, "\\$&")
}

export async function GET(request: NextRequest) {
  const userId = await getUserId(request.headers)
  if (!userId) {
    return fail("Unauthorized", 401)
  }

  const params = request.nextUrl.searchParams
  const format = params.get("format") ?? "markdown"
  const stateParam = params.get("state")
  const tagIdParam = params.get("tag_id")

  if (format !== "markdown") {
    return fail("Only markdown is supported", 400)
  }

  if (stateParam) {
    const parsedState = RecordStateSchema.safeParse(stateParam)
    if (!parsedState.success) {
      return fail("Invalid state", 400)
    }
  }

  if (tagIdParam) {
    const parsedTag = UuidSchema.safeParse(tagIdParam)
    if (!parsedTag.success) {
      return fail("Invalid tag_id", 400)
    }
  }

  const supabase = getSupabaseAdmin()
  let recordIdsByTag: string[] | null = null
  if (tagIdParam) {
    const links = await supabase
      .from("record_tags")
      .select("record_id")
      .eq("tag_id", tagIdParam)

    if (links.error) {
      return fail(links.error.message, 500)
    }

    recordIdsByTag = links.data.map((item) => item.record_id)
    if (recordIdsByTag.length === 0) {
      const emptyContent = `# Rebar Export — ${new Date().toISOString().slice(0, 10)}\n`
      return new Response(emptyContent, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="rebar-export-${new Date().toISOString().slice(0, 10)}.md"`
        }
      })
    }
  }

  let query = supabase
    .from("records")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (stateParam) {
    query = query.eq("state", stateParam)
  }

  if (recordIdsByTag) {
    query = query.in("id", recordIdsByTag)
  }

  const result = await query
  if (result.error) {
    return fail(result.error.message, 500)
  }

  const records = result.data
  const recordIds = records.map((record) => record.id)
  const tagMap = new Map<string, string[]>()

  if (recordIds.length > 0) {
    const linkResult = await supabase
      .from("record_tags")
      .select("record_id, tag_id")
      .in("record_id", recordIds)

    if (linkResult.error) {
      return fail(linkResult.error.message, 500)
    }

    const tagIds = Array.from(new Set(linkResult.data.map((item) => item.tag_id)))
    let tagsById = new Map<string, string>()

    if (tagIds.length > 0) {
      const tagsResult = await supabase
        .from("tags")
        .select("id, name")
        .eq("user_id", userId)
        .in("id", tagIds)

      if (tagsResult.error) {
        return fail(tagsResult.error.message, 500)
      }

      tagsById = new Map(tagsResult.data.map((tag) => [tag.id, tag.name]))
    }

    for (const link of linkResult.data) {
      const current = tagMap.get(link.record_id) ?? []
      const tagName = tagsById.get(link.tag_id)
      if (tagName) {
        current.push(tagName)
      }
      tagMap.set(link.record_id, current)
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const sections: string[] = [`# Rebar Export — ${today}`, ""]

  for (const record of records) {
    sections.push(`## ${record.source_title ?? record.kind} (${record.created_at.slice(0, 10)})`)
    sections.push("")
    sections.push(record.content)
    sections.push("")

    const names = tagMap.get(record.id) ?? []
    if (names.length > 0) {
      sections.push(`Tags: ${names.map((name) => `#${escapeMarkdown(name)}`).join(" ")}`)
    }

    if (record.url) {
      sections.push(`URL: ${record.url}`)
    }

    sections.push("")
    sections.push("---")
    sections.push("")
  }

  const filename = `rebar-export-${today}.md`
  return new Response(sections.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  })
}
