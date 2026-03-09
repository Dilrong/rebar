import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { fail, internalError, rateLimited } from "@/lib/http"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { RecordKindSchema, RecordStateSchema } from "@/lib/schemas"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { buildExportFilename, getExportContentType, isExportFormat, type ExportFormat } from "@feature-lib/export/formats"
import type { RecordRow, RecordTagRow, SourceRow, TagRow } from "@/lib/types"

const UuidSchema = z.string().uuid()
const RECORD_EXPORT_SELECT = "id, user_id, source_id, kind, content, content_hash, url, source_title, favicon_url, current_note, note_updated_at, adopted_from_ai, state, interval_days, due_at, last_reviewed_at, review_count, created_at, updated_at"
const SOURCE_EXPORT_SELECT = "id, user_id, source_type, identity_key, title, author, url, service, external_source_id, created_at, updated_at"

type ExportRecord = RecordRow & {
  source: SourceRow | null
  tags: string[]
}

type ExportFilters = {
  format: ExportFormat
  state: z.infer<typeof RecordStateSchema> | null
  kind: z.infer<typeof RecordKindSchema> | null
  tagId: string | null
  since: string | null
}

function escapeMarkdown(value: string) {
  return value.replace(/[\\`*_{}\[\]()#+\-.!|>]/g, "\\$&")
}

function escapeCsv(value: string | number | boolean | null | undefined) {
  const normalized = value == null ? "" : String(value)
  if (!/[",\r\n]/.test(normalized)) {
    return normalized
  }

  return `"${normalized.replace(/"/g, "\"\"")}"`
}

function replaceLineBreaks(value: string) {
  return value.replace(/\r?\n/g, " ").trim()
}

function toFilterSummary(filters: ExportFilters) {
  const parts: string[] = []

  if (filters.state) {
    parts.push(`state=${filters.state}`)
  }

  if (filters.kind) {
    parts.push(`kind=${filters.kind}`)
  }

  if (filters.tagId) {
    parts.push(`tag_id=${filters.tagId}`)
  }

  if (filters.since) {
    parts.push(`since=${filters.since}`)
  }

  return parts
}

function toObsidianFrontmatter(record: ExportRecord) {
  const lines = [
    "---",
    `id: ${record.id}`,
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
  if (record.source?.source_type) {
    lines.push(`source_type: ${record.source.source_type}`)
  }
  if (record.source?.author) {
    lines.push(`source_author: "${record.source.author.replace(/"/g, "\\\"")}"`)
  }
  if (record.source?.service) {
    lines.push(`source_service: "${record.source.service.replace(/"/g, "\\\"")}"`)
  }
  if (record.source?.external_source_id) {
    lines.push(`external_source_id: "${record.source.external_source_id.replace(/"/g, "\\\"")}"`)
  }
  if (record.adopted_from_ai) {
    lines.push("adopted_from_ai: true")
  }
  if (record.tags.length > 0) {
    lines.push(`tags: [${record.tags.map((name) => `"${name.replace(/"/g, "\\\"")}"`).join(", ")}]`)
  }

  lines.push("---", "")
  return lines.join("\n")
}

function parseSince(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function toJsonExport(records: ExportRecord[], exportedAt: string, filters: ExportFilters) {
  return JSON.stringify(
    {
      exported_at: exportedAt,
      filters,
      total: records.length,
      records
    },
    null,
    2
  )
}

function toCsvExport(records: ExportRecord[]) {
  const header = [
    "id",
    "kind",
    "state",
    "content",
    "current_note",
    "source_title",
    "url",
    "tags",
    "source_type",
    "source_author",
    "source_service",
    "source_identity_key",
    "external_source_id",
    "created_at",
    "updated_at",
    "due_at",
    "last_reviewed_at",
    "review_count",
    "adopted_from_ai"
  ]

  const rows = records.map((record) =>
    [
      record.id,
      record.kind,
      record.state,
      record.content,
      record.current_note,
      record.source_title,
      record.url,
      record.tags.join("|"),
      record.source?.source_type ?? "",
      record.source?.author ?? "",
      record.source?.service ?? "",
      record.source?.identity_key ?? "",
      record.source?.external_source_id ?? "",
      record.created_at,
      record.updated_at,
      record.due_at,
      record.last_reviewed_at,
      record.review_count,
      record.adopted_from_ai
    ]
      .map((value) => escapeCsv(value))
      .join(",")
  )

  return [header.join(","), ...rows].join("\r\n")
}

function toMarkdownExport(records: ExportRecord[], exportedAt: string, filters: ExportFilters) {
  const today = exportedAt.slice(0, 10)
  const sections: string[] = [`# Rebar Export - ${today}`, ""]
  const summary = toFilterSummary(filters)

  if (summary.length > 0) {
    sections.push(`> Filters: ${summary.join(" | ")}`)
    sections.push("")
  }

  for (const record of records) {
    sections.push(`## ${record.source_title ?? record.source?.title ?? record.kind} (${record.created_at.slice(0, 10)})`)
    sections.push("")
    sections.push(record.content)
    sections.push("")

    if (record.current_note) {
      sections.push("Note:")
      sections.push(record.current_note)
      sections.push("")
    }

    if (record.tags.length > 0) {
      sections.push(`Tags: ${record.tags.map((name) => `#${escapeMarkdown(name)}`).join(" ")}`)
    }

    if (record.source?.author) {
      sections.push(`Author: ${record.source.author}`)
    }

    if (record.url) {
      sections.push(`URL: ${record.url}`)
    }

    if (record.adopted_from_ai) {
      sections.push("Provenance: adopted-from-ai")
    }

    sections.push("")
    sections.push("---")
    sections.push("")
  }

  return sections.join("\n")
}

function toObsidianExport(records: ExportRecord[], exportedAt: string, filters: ExportFilters) {
  if (records.length === 0) {
    return toMarkdownExport([], exportedAt, filters)
  }

  return records
    .map((record) => {
      const frontmatter = toObsidianFrontmatter(record)
      const noteBlock = record.current_note ? `\n\n## Note\n\n${record.current_note}\n` : "\n"
      return `${frontmatter}${record.content}${noteBlock}`
    })
    .join("\n")
}

function toLogseqTag(name: string) {
  return `#[[${name.replace(/\]/g, "\\]")}]]`
}

function toNestedLogseqBlocks(label: string, value: string) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    return []
  }

  return [`  - ${label}`, ...lines.map((line) => `    - ${line}`)]
}

function toLogseqExport(records: ExportRecord[], exportedAt: string, filters: ExportFilters) {
  const lines = ["- Rebar export", `  exported_at:: ${exportedAt}`]
  const summary = toFilterSummary(filters)

  if (summary.length > 0) {
    lines.push(`  filters:: ${summary.join(" | ")}`)
  }

  for (const record of records) {
    lines.push(`- ${replaceLineBreaks(record.source_title ?? record.source?.title ?? record.kind)}`)
    lines.push(`  id:: ${record.id}`)
    lines.push(`  kind:: ${record.kind}`)
    lines.push(`  state:: ${record.state}`)
    lines.push(`  created_at:: ${record.created_at}`)
    lines.push(`  updated_at:: ${record.updated_at}`)

    if (record.url) {
      lines.push(`  url:: ${record.url}`)
    }

    if (record.tags.length > 0) {
      lines.push(`  tags:: ${record.tags.map((name) => toLogseqTag(name)).join(" ")}`)
    }

    lines.push(...toNestedLogseqBlocks("content", record.content))

    if (record.current_note) {
      lines.push(...toNestedLogseqBlocks("note", record.current_note))
    }

    lines.push("")
  }

  return `${lines.join("\n").trimEnd()}\n`
}

function toExportBody(format: ExportFormat, records: ExportRecord[], exportedAt: string, filters: ExportFilters) {
  switch (format) {
    case "json":
      return toJsonExport(records, exportedAt, filters)
    case "csv":
      return toCsvExport(records)
    case "obsidian":
      return toObsidianExport(records, exportedAt, filters)
    case "logseq":
      return toLogseqExport(records, exportedAt, filters)
    case "markdown":
    default:
      return toMarkdownExport(records, exportedAt, filters)
  }
}

function createExportResponse(format: ExportFormat, records: ExportRecord[], exportedAt: string, filters: ExportFilters) {
  const today = exportedAt.slice(0, 10)
  const body = toExportBody(format, records, exportedAt, filters)

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": getExportContentType(format),
      "Content-Disposition": `attachment; filename="${buildExportFilename(format, today, filters.since)}"`
    }
  })
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
  const rawFormat = params.get("format") ?? "markdown"
  const stateParam = params.get("state")
  const kindParam = params.get("kind")
  const tagIdParam = params.get("tag_id")
  const sinceParam = params.get("since")
  const exportedAt = new Date().toISOString()
  let validState: z.infer<typeof RecordStateSchema> | undefined
  let validKind: z.infer<typeof RecordKindSchema> | undefined

  if (!isExportFormat(rawFormat)) {
    return fail("Supported formats: markdown, obsidian, json, csv, logseq", 400)
  }

  if (stateParam) {
    const parsedState = RecordStateSchema.safeParse(stateParam)
    if (!parsedState.success) {
      return fail("Invalid state", 400)
    }

    validState = parsedState.data
  }

  if (kindParam) {
    const parsedKind = RecordKindSchema.safeParse(kindParam)
    if (!parsedKind.success) {
      return fail("Invalid kind", 400)
    }

    validKind = parsedKind.data
  }

  if (tagIdParam) {
    const parsedTag = UuidSchema.safeParse(tagIdParam)
    if (!parsedTag.success) {
      return fail("Invalid tag_id", 400)
    }
  }

  const sinceDate = parseSince(sinceParam)
  if (sinceParam && !sinceDate) {
    return fail("Invalid since", 400)
  }

  const filters: ExportFilters = {
    format: rawFormat,
    state: validState ?? null,
    kind: validKind ?? null,
    tagId: tagIdParam ?? null,
    since: sinceDate?.toISOString() ?? null
  }

  const supabase = getSupabaseAdmin()
  let recordIdsByTag: string[] | undefined

  if (tagIdParam) {
    const ownedTag = await supabase
      .from("tags")
      .select("id")
      .eq("id", tagIdParam)
      .eq("user_id", userId)
      .maybeSingle()

    if (ownedTag.error) {
      return internalError("export", ownedTag.error)
    }

    if (!ownedTag.data) {
      return createExportResponse(rawFormat, [], exportedAt, filters)
    }

    const links = await supabase
      .from("record_tags")
      .select("record_id")
      .eq("tag_id", tagIdParam)

    if (links.error) {
      return internalError("export", links.error)
    }

    recordIdsByTag = (links.data ?? []).map((item) => item.record_id)
    if (recordIdsByTag.length === 0) {
      return createExportResponse(rawFormat, [], exportedAt, filters)
    }
  }

  let query = supabase
    .from("records")
    .select(RECORD_EXPORT_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (validState) {
    query = query.eq("state", validState)
  }

  if (validKind) {
    query = query.eq("kind", validKind)
  }

  if (!validState) {
    query = query.neq("state", "TRASHED")
  }

  if (recordIdsByTag) {
    query = query.in("id", recordIdsByTag)
  }

  if (sinceDate) {
    query = query.gte("updated_at", sinceDate.toISOString())
  }

  const result = await query
  if (result.error) {
    return internalError("export", result.error)
  }

  const records = (result.data ?? []) as RecordRow[]
  const recordIds = records.map((record) => record.id)
  const tagMap = new Map<string, string[]>()
  const sourceMap = new Map<string, SourceRow>()

  if (recordIds.length > 0) {
    const linkResult = await supabase
      .from("record_tags")
      .select("record_id, tag_id")
      .in("record_id", recordIds)

    if (linkResult.error) {
      return internalError("export", linkResult.error)
    }

    const recordTagRows = (linkResult.data ?? []) as RecordTagRow[]
    const tagIds = Array.from(new Set(recordTagRows.map((item) => item.tag_id)))
    let tagsById = new Map<string, string>()

    if (tagIds.length > 0) {
      const tagsResult = await supabase
        .from("tags")
        .select("id, name")
        .eq("user_id", userId)
        .in("id", tagIds)

      if (tagsResult.error) {
        return internalError("export", tagsResult.error)
      }

      const tags = (tagsResult.data ?? []) as Pick<TagRow, "id" | "name">[]
      tagsById = new Map(tags.map((tag) => [tag.id, tag.name]))
    }

    for (const link of recordTagRows) {
      const tagName = tagsById.get(link.tag_id)
      if (!tagName) {
        continue
      }

      const current = tagMap.get(link.record_id) ?? []
      current.push(tagName)
      current.sort((left, right) => left.localeCompare(right))
      tagMap.set(link.record_id, current)
    }

    const sourceIds = Array.from(new Set(records.map((record) => record.source_id).filter((value): value is string => Boolean(value))))
    if (sourceIds.length > 0) {
      const sourcesResult = await supabase
        .from("sources")
        .select(SOURCE_EXPORT_SELECT)
        .eq("user_id", userId)
        .in("id", sourceIds)

      if (sourcesResult.error) {
        return internalError("export", sourcesResult.error)
      }

      const sources = (sourcesResult.data ?? []) as SourceRow[]
      for (const source of sources) {
        sourceMap.set(source.id, source)
      }
    }
  }

  const exportRecords: ExportRecord[] = records.map((record) => ({
    ...record,
    source: record.source_id ? sourceMap.get(record.source_id) ?? null : null,
    tags: tagMap.get(record.id) ?? []
  }))

  return createExportResponse(rawFormat, exportRecords, exportedAt, filters)
}
