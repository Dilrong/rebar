import { NextRequest } from "next/server"
import { lookup as dnsLookup } from "node:dns"
import { request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"
import type { IncomingHttpHeaders } from "node:http"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { fail, ok, rateLimited } from "@/lib/http"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"

const BodySchema = z.object({
  url: z.string().url()
})

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false
  }

  if (parts[0] === 10) return true
  if (parts[0] === 127) return true
  if (parts[0] === 0) return true
  if (parts[0] === 169 && parts[1] === 254) return true
  if (parts[0] === 192 && parts[1] === 168) return true
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true

  return false
}

function isPrivateIpv6(address: string): boolean {
  const lowered = address.toLowerCase()
  return lowered === "::1" || lowered.startsWith("fc") || lowered.startsWith("fd") || lowered.startsWith("fe80:")
}

function isPrivateIp(address: string): boolean {
  const version = isIP(address)
  if (version === 4) {
    return isPrivateIpv4(address)
  }
  if (version === 6) {
    return isPrivateIpv6(address)
  }

  return false
}

function isBlockedHostname(hostname: string): boolean {
  const lowered = hostname.toLowerCase()

  if (lowered === "localhost" || lowered.endsWith(".localhost")) {
    return true
  }

  if (lowered.endsWith(".local") || lowered.endsWith(".internal")) {
    return true
  }

  if (lowered === "metadata.google.internal" || lowered === "metadata") {
    return true
  }

  return isPrivateIp(lowered)
}

async function resolvesToPrivateAddress(hostname: string): Promise<boolean> {
  if (isBlockedHostname(hostname)) {
    return true
  }

  try {
    const records = await lookup(hostname, { all: true, verbatim: true })
    return records.some((record) => isPrivateIp(record.address))
  } catch {
    return false
  }
}

type RequestResult = {
  statusCode: number
  headers: IncomingHttpHeaders
  body: string
}

function requestHtmlWithPinnedLookup(targetUrl: URL): Promise<RequestResult | null> {
  return new Promise((resolve) => {
    const client = targetUrl.protocol === "https:" ? httpsRequest : httpRequest
    const request = client(
      targetUrl,
      {
        method: "GET",
        timeout: 10_000,
        lookup(hostname, _options, callback) {
          dnsLookup(hostname, { family: 0, all: false, verbatim: true }, (error, address, family) => {
            if (error) {
              callback(error, "", 4)
              return
            }

            if (!address || isPrivateIp(address)) {
              callback(new Error("URL host is not allowed"), "", family ?? 4)
              return
            }

            callback(null, address, family)
          })
        }
      },
      (response) => {
        const chunks: string[] = []
        response.setEncoding("utf8")
        response.on("data", (chunk: string) => {
          chunks.push(chunk)
        })
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            headers: response.headers,
            body: chunks.join("")
          })
        })
      }
    )

    request.on("timeout", () => {
      request.destroy()
      resolve(null)
    })

    request.on("error", () => {
      resolve(null)
    })

    request.end()
  })
}

async function fetchWithGuards(inputUrl: URL): Promise<RequestResult | null> {
  let currentUrl = new URL(inputUrl.toString())

  for (let index = 0; index < 5; index += 1) {
    if (currentUrl.protocol !== "http:" && currentUrl.protocol !== "https:") {
      return null
    }

    if (await resolvesToPrivateAddress(currentUrl.hostname)) {
      return null
    }

    const response = await requestHtmlWithPinnedLookup(currentUrl)

    if (!response) {
      return null
    }

    const isRedirect = response.statusCode >= 300 && response.statusCode < 400
    if (!isRedirect) {
      return response
    }

    const locationHeader = response.headers.location
    const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader
    if (!location) {
      return null
    }

    try {
      currentUrl = new URL(location, currentUrl)
    } catch {
      return null
    }
  }

  return null
}

function pickMetaContent(html: string, name: string): string | null {
  const regex = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  )
  const matched = html.match(regex)
  return decodeEntities(matched?.[1]?.trim() ?? "") || null
}

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function normalizeText(input: string): string {
  return decodeEntities(input)
    .replace(/\s+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function stripHtml(input: string): string {
  return normalizeText(
    input
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
      .replace(/<form[\s\S]*?<\/form>/gi, " ")
      .replace(/<button[\s\S]*?<\/button>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
}

function extractMainHtml(html: string): string {
  const candidates = [
    /<article\b[^>]*>([\s\S]*?)<\/article>/gi,
    /<main\b[^>]*>([\s\S]*?)<\/main>/gi,
    /<div\b[^>]*(?:id|class)=["'][^"']*(?:se-main-container|se_component_wrap|blog2_post_view|tt_article_useless_p_margin|article_view|velog-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    /<div\b[^>]*(?:id|class)=["'][^"']*(?:content|article|post|entry|main|body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi
  ]

  let best = ""
  for (const regex of candidates) {
    for (const match of html.matchAll(regex)) {
      const chunk = match[1] ?? ""
      if (chunk.length > best.length) {
        best = chunk
      }
    }
  }

  if (best.length > 0) {
    return best
  }

  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)
  return bodyMatch?.[1] ?? html
}

function createYoutubeContent(title: string | null, description: string | null): string {
  const parts: string[] = []
  if (title) {
    parts.push(`YouTube 영상: ${title}`)
  }
  if (description) {
    parts.push(description)
  }

  return parts.join("\n\n").slice(0, 1800)
}

function isYoutubeHostname(hostname: string): boolean {
  return hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "youtu.be" || hostname.endsWith(".youtu.be")
}

export async function POST(request: NextRequest) {
  const limitResult = await checkRateLimitDistributed({
    key: `capture:extract:${resolveClientKey(request.headers)}`,
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

  const body = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 400)
  }

  const targetUrl = new URL(parsed.data.url)

  if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
    return fail("Only http/https URLs are allowed", 400)
  }

  if (await resolvesToPrivateAddress(targetUrl.hostname)) {
    return fail("URL host is not allowed", 400)
  }

  const response = await fetchWithGuards(targetUrl)

  if (!response || response.statusCode < 200 || response.statusCode >= 300) {
    return fail("Failed to fetch URL", 400)
  }

  const html = response.body
  const hostname = targetUrl.hostname.toLowerCase()
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const titleFromTag = decodeEntities(titleMatch?.[1]?.trim() ?? "")
  const title =
    pickMetaContent(html, "og:title") ??
    pickMetaContent(html, "twitter:title") ??
    (titleFromTag.length > 0 ? titleFromTag : null)

  const description =
    pickMetaContent(html, "og:description") ??
    pickMetaContent(html, "twitter:description") ??
    pickMetaContent(html, "description") ??
    null

  if (isYoutubeHostname(hostname)) {
    return ok({
      url: parsed.data.url,
      title,
      description,
      content: createYoutubeContent(title, description)
    })
  }

  const mainHtml = extractMainHtml(html)
  const mainText = stripHtml(mainHtml)
  const fallbackText = stripHtml(html)

  const bodyContent = mainText.length >= 120 ? mainText : fallbackText
  const content = (description && description.length > 80 ? description : bodyContent).slice(0, 1800)

  return ok({
    url: parsed.data.url,
    title,
    description,
    content
  })
}
