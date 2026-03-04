import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { fail, rateLimited } from "@/lib/http"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { RecordStateSchema } from "@/lib/schemas"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const UuidSchema = z.string().uuid()

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}\[\]()#+\-.!|>]/g, "\\$&")
}

function toObsidianFrontmatter(record: {
  kind: string
  state: string
  source_title: string | null
  url: string | null
  created_at: string
  updated_at: string
},
tagNames: string[]) {
  const lines = [
    "---",
    `kind: ${record.kind}`,
    `state: ${record.state}`,
    `created_at: ${record.created_at}`,
    `updated_at: ${record.updated_at}`
  ]

  if (record.source_title) {
    lines.push(`source_title: "${record.source_title.replace(/"/g, "\\\"")}"`)
  }
  if (record.url) {
    lines.push(`url: "${record.url.replace(/"/g, "\\\"")}"`)
  }
  if (tagNames.length > 0) {
    lines.push(`tags: [${tagNames.map((name) => `"${name.replace(/"/g, "\\\"")}"`).join(", ")}]`)
  }

  lines.push("---", "")
  return lines.join("\n")
}

export async function GET(request: NextRequest) {
  const limitResult = await checkRateLimitDistributed({
    key: `export:get:${resolveClientKey(request.headers)}`,
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

  const params = request.nextUrl.searchParams
  const format = params.get("format") ?? "markdown"
  const stateParam = params.get("state")
  const tagIdParam = params.get("tag_id")
  let validState: z.infer<typeof RecordStateSchema> | undefined

  if (format !== "markdown" && format !== "obsidian") {
    return fail("Supported formats: markdown, obsidian", 400)
  }

  if (stateParam) {
    const parsedState = RecordStateSchema.safeParse(stateParam)
    if (!parsedState.success) {
      return fail("Invalid state", 400)
    }

    validState = parsedState.data
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
    const ownedTag = await supabase
      .from("tags")
      .select("id")
      .eq("id", tagIdParam)
      .eq("user_id", userId)
      .maybeSingle()

    if (ownedTag.error) {
      return fail(ownedTag.error.message, 500)
    }

    if (!ownedTag.data) {
      const emptyContent = `# Rebar Export — ${new Date().toISOString().slice(0, 10)}\n`
      return new Response(emptyContent, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="rebar-export-${new Date().toISOString().slice(0, 10)}.md"`
        }
      })
    }

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

  if (validState) {
    query = query.eq("state", validState)
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

  const markdownContent = sections.join("\n")

  if (format === "obsidian") {
    const obsidianNotes = records
      .map((record) => {
        const names = tagMap.get(record.id) ?? []
        const frontmatter = toObsidianFrontmatter(record, names)
        return `${frontmatter}${record.content}\n`
      })
      .join("\n")

    const obsidianFilename = `rebar-obsidian-export-${today}.md`
    return new Response(obsidianNotes, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${obsidianFilename}"`
      }
    })
  }

  const filename = `rebar-export-${today}.md`
  return new Response(markdownContent, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  })
}
