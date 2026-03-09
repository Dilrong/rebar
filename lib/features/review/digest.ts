import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { deliverySucceeded, skippedDelivery, type NotificationDeliveryResult } from "@feature-lib/notifications/delivery"
import { sendEmailMessage } from "@feature-lib/notifications/email"
import { sendTelegramMessage } from "@feature-lib/notifications/telegram"
import { sendWebhookEvent } from "@feature-lib/notifications/webhooks"
import type { RecordRow, RecordTagRow, ReviewLogRow, SourceRow, TagRow } from "@/lib/types"

const REVIEWABLE_STATES = ["INBOX", "ACTIVE", "PINNED"] as const
const DAILY_REVIEW_LIMIT = 5
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

type DeliverySummary = {
  email: NotificationDeliveryResult
  webhook: NotificationDeliveryResult
  telegram: NotificationDeliveryResult
}

type DueReviewRecord = Pick<RecordRow, "id" | "content" | "source_title" | "url" | "due_at" | "state">

function trimInline(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim()
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized
}

function formatSourceLabel(record: DueReviewRecord) {
  return record.source_title?.trim() || record.url?.trim() || record.state
}

function formatDailyReviewText(records: DueReviewRecord[]) {
  const lines = [
    "Rebar Daily Review",
    `Due now: ${records.length}`
  ]

  for (const [index, record] of records.entries()) {
    lines.push(`${index + 1}. ${formatSourceLabel(record)}`)
    lines.push(`   ${trimInline(record.content, 140)}`)
    if (record.url) {
      lines.push(`   ${record.url}`)
    }
  }

  return lines.join("\n")
}

function formatDailyReviewSubject(count: number) {
  return `Rebar Daily Review (${count} due)`
}

function formatWeeklyDigestText(data: {
  captures: number
  reviews: number
  topTags: Array<{ name: string; count: number }>
  topSource: { name: string; count: number } | null
}) {
  const lines = [
    "Rebar Weekly Digest",
    `Captures: ${data.captures}`,
    `Reviews: ${data.reviews}`,
    `Top tags: ${data.topTags.length > 0 ? data.topTags.map((tag) => `${tag.name}(${tag.count})`).join(", ") : "none"}`,
    `Top source: ${data.topSource ? `${data.topSource.name}(${data.topSource.count})` : "none"}`
  ]

  return lines.join("\n")
}

function formatWeeklyDigestSubject() {
  return "Rebar Weekly Digest"
}

function didSendAnything(deliveries: DeliverySummary) {
  return [deliveries.email, deliveries.webhook, deliveries.telegram].some(deliverySucceeded)
}

function buildSkippedDeliveries(): DeliverySummary {
  return {
    email: skippedDelivery(),
    webhook: skippedDelivery(),
    telegram: skippedDelivery()
  }
}

async function deliverDigestNotification(params: {
  eventType: "review.daily_digest" | "review.weekly_digest"
  userId: string
  data: unknown
  subject: string
  text: string
}) {
  const occurredAt = new Date().toISOString()
  const safeDeliver = <T>(promise: Promise<T>, fallbackError: string): Promise<T | NotificationDeliveryResult> =>
    promise.catch((error): NotificationDeliveryResult => ({
      ok: false,
      error: error instanceof Error ? error.message : fallbackError
    }))

  const [webhook, telegram, email] = await Promise.all([
    safeDeliver(
      sendWebhookEvent("notification", {
        type: params.eventType,
        occurred_at: occurredAt,
        user_id: params.userId,
        data: params.data
      }),
      "Webhook delivery failed"
    ),
    safeDeliver(sendTelegramMessage(params.text), "Telegram delivery failed"),
    safeDeliver(
      sendEmailMessage({
        subject: params.subject,
        text: params.text
      }),
      "Email delivery failed"
    )
  ])

  return { email, webhook, telegram }
}

export async function sendDailyReviewDigest(userId: string) {
  const supabase = getSupabaseAdmin()
  const nowIso = new Date().toISOString()
  const result = await supabase
    .from("records")
    .select("id, content, source_title, url, due_at, state")
    .eq("user_id", userId)
    .in("state", [...REVIEWABLE_STATES])
    .lte("due_at", nowIso)
    .order("due_at", { ascending: true })
    .limit(DAILY_REVIEW_LIMIT)

  if (result.error) {
    return { ok: false as const, error: result.error.message }
  }

  const records = (result.data ?? []) as DueReviewRecord[]
  if (records.length === 0) {
    return {
      ok: true as const,
      sent: false,
      items: 0,
      deliveries: buildSkippedDeliveries()
    }
  }

  const message = formatDailyReviewText(records)
  const deliveries = await deliverDigestNotification({
    eventType: "review.daily_digest",
    userId,
    subject: formatDailyReviewSubject(records.length),
    text: message,
    data: {
      total: records.length,
      records
    }
  })

  return {
    ok: true as const,
    sent: didSendAnything(deliveries),
    items: records.length,
    deliveries
  }
}

export async function sendWeeklyDigest(userId: string) {
  const supabase = getSupabaseAdmin()
  const sinceIso = new Date(Date.now() - WEEK_MS).toISOString()
  const [recordsResult, reviewsResult] = await Promise.all([
    supabase
      .from("records")
      .select("id, source_id, source_title, created_at")
      .eq("user_id", userId)
      .gte("created_at", sinceIso),
    supabase
      .from("review_log")
      .select("id, reviewed_at")
      .eq("user_id", userId)
      .gte("reviewed_at", sinceIso)
  ])

  if (recordsResult.error) {
    return { ok: false as const, error: recordsResult.error.message }
  }

  if (reviewsResult.error) {
    return { ok: false as const, error: reviewsResult.error.message }
  }

  const records = (recordsResult.data ?? []) as Array<Pick<RecordRow, "id" | "source_id" | "source_title" | "created_at">>
  const reviews = (reviewsResult.data ?? []) as Array<Pick<ReviewLogRow, "id" | "reviewed_at">>

  const recordIds = records.map((record) => record.id)
  const sourceIds = Array.from(new Set(records.map((record) => record.source_id).filter((value): value is string => Boolean(value))))

  let recordTags: RecordTagRow[] = []
  if (recordIds.length > 0) {
    const recordTagsResult = await supabase
      .from("record_tags")
      .select("record_id, tag_id")
      .in("record_id", recordIds)

    if (recordTagsResult.error) {
      return { ok: false as const, error: recordTagsResult.error.message }
    }

    recordTags = (recordTagsResult.data ?? []) as RecordTagRow[]
  }

  let tagNames = new Map<string, string>()
  const tagIds = Array.from(new Set(recordTags.map((row) => row.tag_id)))
  if (tagIds.length > 0) {
    const tagsResult = await supabase
      .from("tags")
      .select("id, name")
      .eq("user_id", userId)
      .in("id", tagIds)

    if (tagsResult.error) {
      return { ok: false as const, error: tagsResult.error.message }
    }

    tagNames = new Map(((tagsResult.data ?? []) as Pick<TagRow, "id" | "name">[]).map((tag) => [tag.id, tag.name]))
  }

  let sourceNames = new Map<string, string>()
  if (sourceIds.length > 0) {
    const sourcesResult = await supabase
      .from("sources")
      .select("id, title")
      .eq("user_id", userId)
      .in("id", sourceIds)

    if (sourcesResult.error) {
      return { ok: false as const, error: sourcesResult.error.message }
    }

    sourceNames = new Map(((sourcesResult.data ?? []) as Pick<SourceRow, "id" | "title">[]).map((source) => [source.id, source.title ?? "untitled"]))
  }

  const tagCounts = new Map<string, number>()
  for (const row of recordTags) {
    const name = tagNames.get(row.tag_id)
    if (!name) {
      continue
    }

    tagCounts.set(name, (tagCounts.get(name) ?? 0) + 1)
  }

  const sourceCounts = new Map<string, number>()
  for (const record of records) {
    const sourceName =
      (record.source_id ? sourceNames.get(record.source_id) : null) ??
      record.source_title ??
      "untitled"
    sourceCounts.set(sourceName, (sourceCounts.get(sourceName) ?? 0) + 1)
  }

  const topTags = Array.from(tagCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  const topSourceEntry =
    Array.from(sourceCounts.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0] ?? null

  const digest = {
    captures: records.length,
    reviews: reviews.length,
    topTags,
    topSource: topSourceEntry ? { name: topSourceEntry[0], count: topSourceEntry[1] } : null
  }

  if (digest.captures === 0 && digest.reviews === 0) {
    return {
      ok: true as const,
      sent: false,
      digest,
      deliveries: buildSkippedDeliveries()
    }
  }

  const message = formatWeeklyDigestText(digest)
  const deliveries = await deliverDigestNotification({
    eventType: "review.weekly_digest",
    userId,
    subject: formatWeeklyDigestSubject(),
    text: message,
    data: digest
  })

  return {
    ok: true as const,
    sent: didSendAnything(deliveries),
    digest,
    deliveries
  }
}
