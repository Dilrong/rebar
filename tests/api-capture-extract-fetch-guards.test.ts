import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import type { IncomingHttpHeaders } from "node:http"

type LookupRecord = { address: string; family: number }
type DnsLookupCallback = (error: Error | null, address: string, family: number) => void
type RequestLookup = (hostname: string, options: unknown, callback: DnsLookupCallback) => void

type MockHttpResponse = {
  statusCode: number
  headers: IncomingHttpHeaders
  body: string
}

const queuedResponses: MockHttpResponse[] = []
const lookupAllMock = vi.fn<(hostname: string, options: { all: boolean; verbatim: boolean }) => Promise<LookupRecord[]>>()
const dnsLookupMock = vi.fn<
  (hostname: string, options: { family: number; all: false; verbatim: boolean }, callback: DnsLookupCallback) => void
>()
const getUserIdMock = vi.fn<(headers: Headers) => Promise<string | null>>()
const rateLimitMock = vi.fn<() => Promise<{ ok: boolean; retryAfterSec: number; remaining: number }>>()

const httpRequestMock = vi.fn(
  (
    target: URL,
    options: { lookup?: RequestLookup; timeout?: number; method?: string },
    onResponse: (response: {
      statusCode?: number
      headers: IncomingHttpHeaders
      setEncoding: (encoding: string) => void
      on: (event: "data" | "end", listener: (chunk?: string) => void) => void
    }) => void
  ) => {
    const requestListeners = new Map<"timeout" | "error", (error?: Error) => void>()
    const request = {
      on(event: "timeout" | "error", listener: (error?: Error) => void) {
        requestListeners.set(event, listener)
        return request
      },
      destroy() {
        return undefined
      },
      end() {
        const executeResponse = () => {
          const next = queuedResponses.shift() ?? {
            statusCode: 200,
            headers: {},
            body: "<html><head><title>Title</title></head><body><article><p>Body</p></article></body></html>"
          }

          const responseListeners = new Map<"data" | "end", (chunk?: string) => void>()
          const response = {
            statusCode: next.statusCode,
            headers: next.headers,
            setEncoding(_encoding: string) {
              return undefined
            },
            on(event: "data" | "end", listener: (chunk?: string) => void) {
              responseListeners.set(event, listener)
            }
          }

          onResponse(response)
          responseListeners.get("data")?.(next.body)
          responseListeners.get("end")?.()
        }

        if (!options.lookup) {
          executeResponse()
          return
        }

        options.lookup(target.hostname, {}, (error) => {
          if (error) {
            requestListeners.get("error")?.(error)
            return
          }

          executeResponse()
        })
      }
    }

    return request
  }
)

vi.mock("@/lib/auth", () => ({
  getUserId: (headers: Headers) => getUserIdMock(headers)
}))

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimitDistributed: () => rateLimitMock(),
  resolveClientKey: () => "test-client"
}))

vi.mock("node:dns/promises", () => ({
  lookup: (hostname: string, options: { all: boolean; verbatim: boolean }) => lookupAllMock(hostname, options)
}))

vi.mock("node:dns", () => ({
  lookup: (
    hostname: string,
    options: { family: number; all: false; verbatim: boolean },
    callback: DnsLookupCallback
  ) => dnsLookupMock(hostname, options, callback)
}))

vi.mock("node:http", () => ({
  request: (
    target: URL,
    options: { lookup?: RequestLookup; timeout?: number; method?: string },
    onResponse: (response: {
      statusCode?: number
      headers: IncomingHttpHeaders
      setEncoding: (encoding: string) => void
      on: (event: "data" | "end", listener: (chunk?: string) => void) => void
    }) => void
  ) => httpRequestMock(target, options, onResponse)
}))

vi.mock("node:https", () => ({
  request: (
    target: URL,
    options: { lookup?: RequestLookup; timeout?: number; method?: string },
    onResponse: (response: {
      statusCode?: number
      headers: IncomingHttpHeaders
      setEncoding: (encoding: string) => void
      on: (event: "data" | "end", listener: (chunk?: string) => void) => void
    }) => void
  ) => httpRequestMock(target, options, onResponse)
}))

import { routePostCaptureExtract as POST } from "./helpers/routes"

describe("POST /api/capture/extract fetch guards", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queuedResponses.length = 0
    getUserIdMock.mockResolvedValue("11111111-1111-1111-1111-111111111111")
    rateLimitMock.mockResolvedValue({ ok: true, retryAfterSec: 1, remaining: 999 })
    lookupAllMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }])
    dnsLookupMock.mockImplementation((_hostname, _options, callback) => {
      callback(null, "93.184.216.34", 4)
    })
  })

  it("blocks redirect chains that point to private hosts", async () => {
    queuedResponses.push({
      statusCode: 302,
      headers: { location: "http://127.0.0.1/private" },
      body: ""
    })

    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "http://example.com/start" })
      })
    )

    expect(httpRequestMock).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Failed to fetch URL" })
  })

  it("blocks requests when preflight DNS lookup resolves to private address", async () => {
    lookupAllMock.mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }])

    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "http://example.com/private-by-dns" })
      })
    )

    expect(httpRequestMock).toHaveBeenCalledTimes(0)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "URL host is not allowed" })
  })

  it("fails when redirect exceeds maximum depth", async () => {
    for (let i = 0; i < 5; i += 1) {
      queuedResponses.push({
        statusCode: 302,
        headers: { location: `http://example.com/r${i + 1}` },
        body: ""
      })
    }

    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "http://example.com/start" })
      })
    )

    expect(httpRequestMock).toHaveBeenCalledTimes(5)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Failed to fetch URL" })
  })

  it("fails on redirect without location header", async () => {
    queuedResponses.push({
      statusCode: 302,
      headers: {},
      body: ""
    })

    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "http://example.com/start" })
      })
    )

    expect(httpRequestMock).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Failed to fetch URL" })
  })

  it("fails on redirect to non-http protocol", async () => {
    queuedResponses.push({
      statusCode: 302,
      headers: { location: "ftp://example.com/file.txt" },
      body: ""
    })

    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "http://example.com/start" })
      })
    )

    expect(httpRequestMock).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Failed to fetch URL" })
  })

  it("fails when pinned DNS lookup yields private IP", async () => {
    dnsLookupMock.mockImplementation((_hostname, _options, callback) => {
      callback(null, "127.0.0.1", 4)
    })

    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "http://example.com/start" })
      })
    )

    expect(httpRequestMock).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Failed to fetch URL" })
  })

  it("fails on non-html content types", async () => {
    queuedResponses.push({
      statusCode: 200,
      headers: { "content-type": "application/pdf" },
      body: "%PDF-1.7"
    })

    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "http://example.com/file" })
      })
    )

    expect(httpRequestMock).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Failed to fetch URL" })
  })

  it("fails when html response body exceeds the size limit", async () => {
    queuedResponses.push({
      statusCode: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
      body: `<html><body>${"x".repeat(1_100_000)}</body></html>`
    })

    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "http://example.com/large" })
      })
    )

    expect(httpRequestMock).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Failed to fetch URL" })
  })

  it("fails on unsupported response content type", async () => {
    queuedResponses.push({
      statusCode: 200,
      headers: { "content-type": "image/png" },
      body: "binary"
    })

    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "http://example.com/image" })
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Failed to fetch URL" })
  })

  it("fails when content length exceeds the response size limit", async () => {
    queuedResponses.push({
      statusCode: 200,
      headers: { "content-length": "1000001", "content-type": "text/html; charset=utf-8" },
      body: "<html><body>too large</body></html>"
    })

    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "http://example.com/too-large" })
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Failed to fetch URL" })
  })

  it("prefers long meta description over extracted body text", async () => {
    const longDescription = "D".repeat(120)
    queuedResponses.push({
      statusCode: 200,
      headers: {},
      body: `
        <html>
          <head>
            <meta name="description" content="${longDescription}" />
            <title>Long Description</title>
          </head>
          <body>
            <article><p>${"B".repeat(300)}</p></article>
          </body>
        </html>
      `
    })

    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "http://example.com/desc-priority" })
      })
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { content: string; description: string }
    expect(payload.description).toBe(longDescription)
    expect(payload.content).toBe(longDescription)
  })

  it("falls back to full body text when extracted main text is too short", async () => {
    queuedResponses.push({
      statusCode: 200,
      headers: {},
      body: `
        <html>
          <head><title>Fallback Body</title></head>
          <body>
            <article><p>tiny</p></article>
            <div>${"L".repeat(220)}</div>
          </body>
        </html>
      `
    })

    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "http://example.com/body-fallback" })
      })
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { content: string }
    expect(payload.content.includes("L".repeat(80))).toBe(true)
  })

  it("caps content length at 1800 characters", async () => {
    const overlongDescription = "X".repeat(2200)
    queuedResponses.push({
      statusCode: 200,
      headers: {},
      body: `
        <html>
          <head>
            <meta name="description" content="${overlongDescription}" />
            <title>Too Long</title>
          </head>
          <body><article><p>${"Y".repeat(2600)}</p></article></body>
        </html>
      `
    })

    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "http://example.com/truncate" })
      })
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { content: string }
    expect(payload.content.length).toBe(1800)
  })

  it("returns extracted content for normal non-youtube hosts", async () => {
    queuedResponses.push({
      statusCode: 200,
      headers: {},
      body: `
        <html>
          <head>
            <title>Example Title</title>
            <meta name="description" content="short description" />
          </head>
          <body>
            <article><p>Main article body text.</p></article>
          </body>
        </html>
      `
    })

    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "http://example.com/post" })
      })
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      url: string
      title: string
      description: string
      content: string
    }

    expect(payload).toMatchObject({
      url: "http://example.com/post",
      title: "Example Title",
      description: "short description"
    })
    expect(payload.content.includes("Main article body text.")).toBe(true)
    expect(payload.content.startsWith("YouTube 영상:")).toBe(false)
  })

  it("uses youtube formatter for real youtube hosts only", async () => {
    queuedResponses.push({
      statusCode: 200,
      headers: {},
      body: `
        <html>
          <head>
            <meta property="og:title" content="Video Title" />
            <meta property="og:description" content="Video Description" />
          </head>
          <body></body>
        </html>
      `
    })

    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "http://www.youtube.com/watch?v=abc123" })
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      content: "YouTube 영상: Video Title\n\nVideo Description"
    })
  })

  it("does not treat lookalike domains as youtube", async () => {
    queuedResponses.push({
      statusCode: 200,
      headers: {},
      body: `
        <html>
          <head>
            <meta property="og:title" content="Fake Title" />
            <meta property="og:description" content="Fake Description" />
          </head>
          <body>
            <article><p>Normal article text.</p></article>
          </body>
        </html>
      `
    })

    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "http://notyoutube.com/watch?v=abc123" })
      })
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { content: string }
    expect(payload.content).toBe("Normal article text.")
    expect(payload.content.startsWith("YouTube 영상:")).toBe(false)
  })
})
