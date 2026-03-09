import { beforeEach, describe, expect, it, vi } from "vitest"

const fromMock = vi.fn<(table: string) => unknown>()
const sendEmailMessageMock = vi.fn<
  (payload: { subject: string; text: string }) => Promise<{ ok: boolean; skipped?: boolean; status?: number }>
>()
const sendTelegramMessageMock = vi.fn<(text: string) => Promise<{ ok: boolean; skipped?: boolean; status?: number }>>()
const sendWebhookEventMock = vi.fn<
  (kind: "export" | "notification", event: unknown) => Promise<{ ok: boolean; skipped?: boolean; status?: number }>
>()

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: fromMock
  })
}))

vi.mock("@feature-lib/notifications/email", () => ({
  sendEmailMessage: (payload: { subject: string; text: string }) => sendEmailMessageMock(payload)
}))

vi.mock("@feature-lib/notifications/telegram", () => ({
  sendTelegramMessage: (text: string) => sendTelegramMessageMock(text)
}))

vi.mock("@feature-lib/notifications/webhooks", () => ({
  sendWebhookEvent: (kind: "export" | "notification", event: unknown) => sendWebhookEventMock(kind, event)
}))

import { sendDailyReviewDigest, sendWeeklyDigest } from "@feature-lib/review/digest"

function createDailyRecordsQuery(rows: Array<{
  id: string
  content: string
  source_title: string | null
  url: string | null
  due_at: string | null
  state: string
}>) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    lte: () => builder,
    order: () => builder,
    limit: async () => ({
      data: rows,
      error: null
    })
  }

  return builder
}

function createWeeklyRecordsQuery(rows: Array<{
  id: string
  source_id: string | null
  source_title: string | null
  created_at: string
}>) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    gte: async () => ({
      data: rows,
      error: null
    })
  }

  return builder
}

function createWeeklyReviewsQuery(rows: Array<{ id: string; reviewed_at: string }>) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    gte: async () => ({
      data: rows,
      error: null
    })
  }

  return builder
}

function createRecordTagsQuery(rows: Array<{ record_id: string; tag_id: string }>) {
  const builder = {
    select: () => builder,
    in: async () => ({
      data: rows,
      error: null
    })
  }

  return builder
}

function createTagsQuery(rows: Array<{ id: string; name: string }>) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: async () => ({
      data: rows,
      error: null
    })
  }

  return builder
}

function createSourcesQuery(rows: Array<{ id: string; title: string | null }>) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: async () => ({
      data: rows,
      error: null
    })
  }

  return builder
}

describe("review digest delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendWebhookEventMock.mockResolvedValue({ ok: true, skipped: true })
    sendTelegramMessageMock.mockResolvedValue({ ok: true, skipped: true })
    sendEmailMessageMock.mockResolvedValue({ ok: true, status: 202 })
  })

  it("treats email delivery as a successful daily digest send", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table !== "records") {
        throw new Error(`Unexpected table ${table}`)
      }

      return createDailyRecordsQuery([
        {
          id: "record-1",
          content: "First due review item",
          source_title: "Deep Work",
          url: "https://example.com/deep-work",
          due_at: "2026-03-09T00:00:00.000Z",
          state: "ACTIVE"
        },
        {
          id: "record-2",
          content: "Second due review item",
          source_title: null,
          url: "https://example.com/item-2",
          due_at: "2026-03-09T01:00:00.000Z",
          state: "INBOX"
        }
      ])
    })

    const result = await sendDailyReviewDigest("user-1")

    expect(result).toMatchObject({
      ok: true,
      sent: true,
      items: 2
    })
    expect(sendEmailMessageMock).toHaveBeenCalledWith({
      subject: "Rebar Daily Review (2 due)",
      text: expect.stringContaining("Due now: 2")
    })
  })

  it("treats email delivery as a successful weekly digest send", async () => {
    fromMock.mockImplementation((table: string) => {
      switch (table) {
        case "records":
          return createWeeklyRecordsQuery([
            {
              id: "record-1",
              source_id: "source-1",
              source_title: "Deep Work",
              created_at: "2026-03-08T00:00:00.000Z"
            }
          ])
        case "review_log":
          return createWeeklyReviewsQuery([{ id: "review-1", reviewed_at: "2026-03-08T12:00:00.000Z" }])
        case "record_tags":
          return createRecordTagsQuery([{ record_id: "record-1", tag_id: "tag-1" }])
        case "tags":
          return createTagsQuery([{ id: "tag-1", name: "readwise" }])
        case "sources":
          return createSourcesQuery([{ id: "source-1", title: "Deep Work" }])
        default:
          throw new Error(`Unexpected table ${table}`)
      }
    })

    const result = await sendWeeklyDigest("user-1")

    expect(result).toMatchObject({
      ok: true,
      sent: true,
      digest: {
        captures: 1,
        reviews: 1,
        topTags: [{ name: "readwise", count: 1 }],
        topSource: { name: "Deep Work", count: 1 }
      }
    })
    expect(sendEmailMessageMock).toHaveBeenCalledWith({
      subject: "Rebar Weekly Digest",
      text: expect.stringContaining("Captures: 1")
    })
  })

  it("skips weekly digest delivery when there was no activity", async () => {
    fromMock.mockImplementation((table: string) => {
      switch (table) {
        case "records":
          return createWeeklyRecordsQuery([])
        case "review_log":
          return createWeeklyReviewsQuery([])
        default:
          throw new Error(`Unexpected table ${table}`)
      }
    })

    const result = await sendWeeklyDigest("user-1")

    expect(result).toMatchObject({
      ok: true,
      sent: false,
      digest: {
        captures: 0,
        reviews: 0,
        topTags: [],
        topSource: null
      }
    })
    expect(sendWebhookEventMock).not.toHaveBeenCalled()
    expect(sendTelegramMessageMock).not.toHaveBeenCalled()
    expect(sendEmailMessageMock).not.toHaveBeenCalled()
  })
})
