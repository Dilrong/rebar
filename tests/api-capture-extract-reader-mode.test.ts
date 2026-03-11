import { describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const queuedResponses: Array<{ statusCode: number; headers: Record<string, string>; body: string }> = []

function createRequestMock() {
  return (_url: URL, _options: Record<string, unknown>, callback: (response: NodeJS.ReadableStream & { statusCode?: number; headers: Record<string, string>; setEncoding: (encoding: string) => void }) => void) => {
    const queued = queuedResponses.shift()
    if (!queued) {
      throw new Error("No queued response")
    }

    const listeners: Record<string, Array<(chunk?: string) => void>> = { data: [], end: [] }
    const response = {
      statusCode: queued.statusCode,
      headers: queued.headers,
      setEncoding: () => undefined,
      on: (event: "data" | "end", handler: (chunk?: string) => void) => {
        listeners[event].push(handler)
      }
    }

    queueMicrotask(() => {
      callback(response as never)
      queueMicrotask(() => {
        listeners.data.forEach((handler) => handler(queued.body))
        listeners.end.forEach((handler) => handler())
      })
    })

    return {
      on: () => undefined,
      destroy: () => undefined,
      end: () => undefined
    }
  }
}

vi.mock("node:http", () => ({ request: createRequestMock() }))

vi.mock("node:https", () => ({ request: createRequestMock() }))
vi.mock("node:dns/promises", () => ({ lookup: async () => [{ address: "93.184.216.34" }] }))
vi.mock("node:dns", () => ({ lookup: (_hostname: string, _options: Record<string, unknown>, callback: (error: Error | null, address: string, family: number) => void) => callback(null, "93.184.216.34", 4) }))
vi.mock("@/lib/auth", () => ({ getUserId: async () => "user-1" }))
vi.mock("@/lib/rate-limit", () => ({ checkRateLimitDistributed: async () => ({ ok: true, retryAfterSec: 1, remaining: 999 }), resolveClientKey: () => "test-client" }))

import { routePostCaptureExtract as POST } from "./helpers/routes"

describe("POST /api/capture/extract reader mode", () => {
  it("prefers extracted article body over description and preserves reader-friendly breaks", async () => {
    queuedResponses.push({
      statusCode: 200,
      headers: {},
      body: `
        <html>
          <head>
            <title>Reader Title</title>
            <meta name="description" content="Short social description" />
          </head>
          <body>
            <article>
              <h1>Main heading</h1>
              <p>First paragraph with enough body text to beat the short description fallback and feel like a real article paragraph.</p>
              <p>Second paragraph keeps the structure readable for the detail reader.</p>
            </article>
          </body>
        </html>
      `
    })

    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "http://example.com/article" })
      })
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { content: string }
    expect(payload.content).toContain("## Main heading")
    expect(payload.content).toContain("First paragraph with enough body text")
    expect(payload.content).toContain("Second paragraph keeps the structure readable")
    expect(payload.content).not.toBe("Short social description")
  })
})
