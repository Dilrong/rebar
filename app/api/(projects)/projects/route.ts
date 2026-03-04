import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { fail, ok, rateLimited } from "@/lib/http"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const PROJECT_MODE_ENABLED = false
const UuidSchema = z.string().uuid()

type ProjectMetrics = {
  tag_id: string
  name: string
  total: number
  inbox: number
  active: number
  pinned: number
  archived: number
  last_updated_at: string | null
}

type GraphNode = {
  id: string
  label: string
  kind: "project" | "record" | "tag"
  weight: number
}

type GraphEdge = {
  source: string
  target: string
  weight: number
}

function stripPreview(value: string): string {
  return value
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[`*_>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function shortLabel(value: string, max = 40): string {
  if (value.length <= max) {
    return value
  }
  return `${value.slice(0, max - 1)}…`
}

export async function GET(request: NextRequest) {
  const limitResult = await checkRateLimitDistributed({
    key: `projects:get:${resolveClientKey(request.headers)}`,
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

  if (!PROJECT_MODE_ENABLED) {
    return fail("Project mode is temporarily disabled", 503)
  }

  const selectedTagId = request.nextUrl.searchParams.get("tag_id")?.trim() ?? ""
  if (selectedTagId) {
    const parsed = UuidSchema.safeParse(selectedTagId)
    if (!parsed.success) {
      return fail("Invalid tag_id", 400)
    }
  }

  const supabase = getSupabaseAdmin()
  const tagsResult = await supabase
    .from("tags")
    .select("id,name")
    .eq("user_id", userId)
    .order("name", { ascending: true })

  if (tagsResult.error) {
    return fail(tagsResult.error.message, 500)
  }

  const tags = tagsResult.data
  if (tags.length === 0) {
    return ok({ projects: [], selected: null })
  }

  const allTagIds = tags.map((tag) => tag.id)
  const linksResult = await supabase
    .from("record_tags")
    .select("record_id,tag_id")
    .in("tag_id", allTagIds)

  if (linksResult.error) {
    return fail(linksResult.error.message, 500)
  }

  const links = linksResult.data
  const allRecordIds = Array.from(new Set(links.map((link) => link.record_id)))
  if (allRecordIds.length === 0) {
    const emptyProjects: ProjectMetrics[] = tags.map((tag) => ({
      tag_id: tag.id,
      name: tag.name,
      total: 0,
      inbox: 0,
      active: 0,
      pinned: 0,
      archived: 0,
      last_updated_at: null
    }))
    return ok({ projects: emptyProjects, selected: null })
  }

  const recordsResult = await supabase
    .from("records")
    .select("id,kind,state,content,source_title,review_count,created_at,updated_at")
    .eq("user_id", userId)
    .in("id", allRecordIds)
    .neq("state", "TRASHED")

  if (recordsResult.error) {
    return fail(recordsResult.error.message, 500)
  }

  const records = recordsResult.data
  const recordsById = new Map(records.map((record) => [record.id, record]))

  const projects: ProjectMetrics[] = tags
    .map((tag) => {
      const recordIds = Array.from(new Set(links.filter((link) => link.tag_id === tag.id).map((link) => link.record_id)))
      const rows = recordIds
        .map((recordId) => recordsById.get(recordId))
        .filter((row): row is NonNullable<typeof row> => Boolean(row))

      let inbox = 0
      let active = 0
      let pinned = 0
      let archived = 0
      let lastUpdatedMs = 0

      for (const row of rows) {
        if (row.state === "INBOX") inbox += 1
        if (row.state === "ACTIVE") active += 1
        if (row.state === "PINNED") pinned += 1
        if (row.state === "ARCHIVED") archived += 1

        const updatedMs = new Date(row.updated_at).getTime()
        if (!Number.isNaN(updatedMs)) {
          lastUpdatedMs = Math.max(lastUpdatedMs, updatedMs)
        }
      }

      return {
        tag_id: tag.id,
        name: tag.name,
        total: rows.length,
        inbox,
        active,
        pinned,
        archived,
        last_updated_at: lastUpdatedMs > 0 ? new Date(lastUpdatedMs).toISOString() : null
      }
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))

  if (!selectedTagId) {
    return ok({ projects, selected: null })
  }

  const selectedProject = projects.find((project) => project.tag_id === selectedTagId)
  if (!selectedProject) {
    return fail("Project not found", 404)
  }

  const selectedRecordIds = Array.from(
    new Set(links.filter((link) => link.tag_id === selectedTagId).map((link) => link.record_id))
  )

  const selectedRecords = selectedRecordIds
    .map((recordId) => recordsById.get(recordId))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => {
      if (b.review_count !== a.review_count) {
        return b.review_count - a.review_count
      }
      return a.updated_at > b.updated_at ? -1 : 1
    })

  const selectedRecordIdSet = new Set(selectedRecords.map((record) => record.id))
  const reviewLogsResult =
    selectedRecordIds.length > 0
      ? await supabase
          .from("review_log")
          .select("record_id,action,decision_type,action_type,reviewed_at")
          .eq("user_id", userId)
          .in("record_id", selectedRecordIds)
      : { data: [], error: null }

  if (reviewLogsResult.error) {
    return fail(reviewLogsResult.error.message, 500)
  }

  const now = Date.now()
  const weekAgo = now - 7 * 86_400_000
  const recentLogs = reviewLogsResult.data.filter((log) => {
    const reviewedMs = new Date(log.reviewed_at).getTime()
    return !Number.isNaN(reviewedMs) && reviewedMs >= weekAgo
  })

  const teamDigest = {
    reviewed_7d: recentLogs.length,
    archived_7d: recentLogs.filter((log) => log.decision_type === "ARCHIVE").length,
    todo_7d: recentLogs.filter((log) => log.action_type === "TODO").length,
    share_7d: recentLogs.filter((log) => log.action_type === "SHARE").length,
    experiment_7d: recentLogs.filter((log) => log.action_type === "EXPERIMENT").length,
    top_records: selectedRecords.slice(0, 5).map((record) => ({
      id: record.id,
      title: record.source_title,
      preview: shortLabel(stripPreview(record.content), 120),
      state: record.state,
      review_count: record.review_count
    }))
  }

  const selectedLinks = links.filter((link) => selectedRecordIdSet.has(link.record_id))
  const relatedTagWeight = new Map<string, number>()
  for (const link of selectedLinks) {
    if (link.tag_id === selectedTagId) {
      continue
    }
    relatedTagWeight.set(link.tag_id, (relatedTagWeight.get(link.tag_id) ?? 0) + 1)
  }

  const tagNameById = new Map(tags.map((tag) => [tag.id, tag.name]))
  const relatedTags = Array.from(relatedTagWeight.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  const graphNodes: GraphNode[] = [
    {
      id: `project:${selectedTagId}`,
      label: selectedProject.name,
      kind: "project",
      weight: Math.max(selectedProject.total, 1)
    },
    ...selectedRecords.slice(0, 12).map((record) => ({
      id: `record:${record.id}`,
      label: shortLabel(stripPreview(record.source_title || record.content), 34),
      kind: "record" as const,
      weight: Math.max(record.review_count, 1)
    })),
    ...relatedTags.map(([tagId, weight]) => ({
      id: `tag:${tagId}`,
      label: tagNameById.get(tagId) ?? shortLabel(tagId, 12),
      kind: "tag" as const,
      weight
    }))
  ]

  const recordNodeIds = new Set(graphNodes.filter((node) => node.kind === "record").map((node) => node.id.replace("record:", "")))
  const tagNodeIds = new Set(graphNodes.filter((node) => node.kind === "tag").map((node) => node.id.replace("tag:", "")))

  const graphEdges: GraphEdge[] = [
    ...selectedRecords
      .slice(0, 12)
      .map((record) => ({ source: `project:${selectedTagId}`, target: `record:${record.id}`, weight: 1 })),
    ...selectedLinks
      .filter((link) => recordNodeIds.has(link.record_id) && tagNodeIds.has(link.tag_id))
      .map((link) => ({
        source: `record:${link.record_id}`,
        target: `tag:${link.tag_id}`,
        weight: 1
      }))
  ]

  return ok({
    projects,
    selected: {
      project: selectedProject,
      records: selectedRecords.slice(0, 50).map((record) => ({
        id: record.id,
        kind: record.kind,
        state: record.state,
        source_title: record.source_title,
        content_preview: shortLabel(stripPreview(record.content), 180),
        review_count: record.review_count,
        updated_at: record.updated_at
      })),
      team_digest: teamDigest,
      graph: {
        nodes: graphNodes,
        edges: graphEdges
      }
    }
  })
}
