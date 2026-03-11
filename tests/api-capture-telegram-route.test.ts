import { beforeEach, describe, expect, it, vi } from "vitest"

const processIngestMock = vi.fn<(userId: string, payload: unknown, options?: unknown) => Promise<unknown>>()
const isTelegramWebhookAuthorizedMock = vi.fn<(headers: Headers) => { ok: boolean; reason?: string }>()
const getTelegramIngestUserIdMock = vi.fn<() => string | null>()

vi.mock("@feature-lib/capture/ingest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@feature-lib/capture/ingest")>()

  return {
    ...actual,
    processIngest: (userId: string, payload: unknown, options?: unknown) => processIngestMock(userId, payload, options)
  }
})

vi.mock("@feature-lib/notifications/telegram", () => ({
  isTelegramWebhookAuthorized: (headers: Headers) => isTelegramWebhookAuthorizedMock(headers),
  getTelegramIngestUserId: () => getTelegramIngestUserIdMock()
}))

import { routePostCaptureTelegram as POST } from "./helpers/routes"

describe("POST /api/capture/telegram", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isTelegramWebhookAuthorizedMock.mockReturnValue({ ok: true })
    getTelegramIngestUserIdMock.mockReturnValue("user-1")
    processIngestMock.mockResolvedValue({ created: 1, ids: ["rec-1"] })
  })

  it("rejects unauthorized telegram webhook calls", async () => {
    isTelegramWebhookAuthorizedMock.mockReturnValueOnce({ ok: false, reason: "Unauthorized" })

    const response = await POST(new Request("http://localhost/api/capture/telegram", { method: "POST" }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })
  })

  it("ingests telegram text and url into the capture pipeline", async () => {
    const response = await POST(
      new Request("http://localhost/api/capture/telegram", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-telegram-bot-api-secret-token": "secret"
        },
        body: JSON.stringify({
          message: {
            message_id: 12,
            text: "Read later https://example.com/article",
            entities: [{ type: "url", offset: 11, length: 27 }],
            chat: {
              id: 99,
              title: "Saved Messages"
            }
          }
        })
      })
    )

    expect(response.status).toBe(200)
    expect(processIngestMock).toHaveBeenCalledWith(
      "user-1",
      {
        items: [
          {
            content: "Read later",
            url: "https://example.com/article",
            kind: "note",
            source_title: "Telegram: Saved Messages",
            source_type: "service",
            source_service: "telegram",
            source_identity: "99:12",
            external_source_id: "99",
            external_item_id: "12",
            tags: ["telegram"]
          }
        ]
      },
      { importChannel: "share" }
    )
    await expect(response.json()).resolves.toEqual({ created: 1, ids: ["rec-1"], source: "telegram" })
  })

  it("ignores updates without message text", async () => {
    const response = await POST(
      new Request("http://localhost/api/capture/telegram", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          message: {
            message_id: 12,
            chat: {
              id: 99
            }
          }
        })
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ignored: true, reason: "No text content" })
    expect(processIngestMock).not.toHaveBeenCalled()
  })

  it("supports edited channel posts with text_link entities", async () => {
    const response = await POST(
      new Request("http://localhost/api/capture/telegram", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          edited_channel_post: {
            message_id: 44,
            text: "Deep Work",
            entities: [{ type: "text_link", offset: 0, length: 9, url: "https://example.com/deep-work" }],
            chat: {
              id: "@channel",
              title: "Reading Queue"
            }
          }
        })
      })
    )

    expect(response.status).toBe(200)
    expect(processIngestMock).toHaveBeenCalledWith(
      "user-1",
      {
        items: [
          expect.objectContaining({
            content: "Deep Work",
            url: "https://example.com/deep-work",
            kind: "note",
            source_title: "Telegram: Reading Queue",
            source_identity: "@channel:44"
          })
        ]
      },
      { importChannel: "share" }
    )
  })
})
