import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const verifyCronRequestMock = vi.fn<(headers: Headers) => { ok: boolean; response?: Response }>()
const sendDailyReviewDigestMock = vi.fn<(userId: string) => Promise<unknown>>()
const sendWeeklyDigestMock = vi.fn<(userId: string) => Promise<unknown>>()

vi.mock("@/lib/cron", () => ({
  verifyCronRequest: (headers: Headers) => verifyCronRequestMock(headers)
}))

vi.mock("@feature-lib/review/digest", () => ({
  sendDailyReviewDigest: (userId: string) => sendDailyReviewDigestMock(userId),
  sendWeeklyDigest: (userId: string) => sendWeeklyDigestMock(userId)
}))

import { routePostCronReviewDaily as postDaily, routePostCronWeeklyDigest as postWeekly } from "./helpers/routes"

describe("cron review routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyCronRequestMock.mockReturnValue({ ok: true })
    process.env.REBAR_NOTIFICATION_USER_ID = "user-1"
  })

  afterEach(() => {
    delete process.env.REBAR_NOTIFICATION_USER_ID
  })

  it("returns 401 when cron verification fails", async () => {
    verifyCronRequestMock.mockReturnValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" }
      })
    })

    const response = await postDaily(new Request("http://localhost/api/cron/review/daily", { method: "POST" }))
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })
  })

  it("runs daily review digest delivery", async () => {
    sendDailyReviewDigestMock.mockResolvedValueOnce({
      ok: true,
      sent: true,
      items: 3
    })

    const response = await postDaily(new Request("http://localhost/api/cron/review/daily", { method: "POST" }))
    expect(response.status).toBe(200)
    expect(sendDailyReviewDigestMock).toHaveBeenCalledWith("user-1")
    await expect(response.json()).resolves.toEqual({
      ok: true,
      sent: true,
      items: 3
    })
  })

  it("runs weekly digest delivery", async () => {
    sendWeeklyDigestMock.mockResolvedValueOnce({
      ok: true,
      sent: true,
      digest: {
        captures: 8,
        reviews: 5,
        topTags: [{ name: "readwise", count: 4 }],
        topSource: { name: "Deep Work", count: 3 }
      }
    })

    const response = await postWeekly(new Request("http://localhost/api/cron/review/weekly-digest", { method: "POST" }))
    expect(response.status).toBe(200)
    expect(sendWeeklyDigestMock).toHaveBeenCalledWith("user-1")
    await expect(response.json()).resolves.toEqual({
      ok: true,
      sent: true,
      digest: {
        captures: 8,
        reviews: 5,
        topTags: [{ name: "readwise", count: 4 }],
        topSource: { name: "Deep Work", count: 3 }
      }
    })
  })

  it("returns 500 when notification user is not configured", async () => {
    delete process.env.REBAR_NOTIFICATION_USER_ID

    const response = await postWeekly(new Request("http://localhost/api/cron/review/weekly-digest", { method: "POST" }))
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "Notification user is not configured" })
  })
})
