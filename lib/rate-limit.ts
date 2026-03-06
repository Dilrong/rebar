import { isIP } from "node:net"

type RateLimitInput = {
  key: string
  limit: number
  windowMs: number
}

type RateLimitResult = {
  ok: boolean
  retryAfterSec: number
  remaining: number
}

const store = new Map<string, { count: number; resetAt: number }>()

async function upstashCommand(command: Array<string | number>) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    return null
  }

  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify([command]),
    cache: "no-store"
  })

  if (!response.ok) {
    throw new Error(`Upstash rate limit error: ${response.status}`)
  }

  const payload = (await response.json()) as Array<{ result?: unknown; error?: string }>
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error("Upstash rate limit payload missing")
  }

  if (payload[0].error) {
    throw new Error(payload[0].error)
  }

  return payload[0].result
}

let lastCleanup = 0
const CLEANUP_INTERVAL_MS = 60_000
const MAX_IN_MEMORY_KEYS = 5_000

function cleanupExpiredEntries(now: number) {
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key)
    }
  }
}

function trimStoreIfNeeded() {
  if (store.size <= MAX_IN_MEMORY_KEYS) {
    return
  }

  const overflow = store.size - MAX_IN_MEMORY_KEYS
  const oldestEntries = [...store.entries()]
    .sort((left, right) => left[1].resetAt - right[1].resetAt)
    .slice(0, overflow)

  for (const [key] of oldestEntries) {
    store.delete(key)
  }
}

export function checkRateLimit(input: RateLimitInput): RateLimitResult {
  const now = Date.now()

  if (store.size > 500 || (store.size > 0 && now - lastCleanup > CLEANUP_INTERVAL_MS)) {
    cleanupExpiredEntries(now)
    trimStoreIfNeeded()
    lastCleanup = now
  }

  const current = store.get(input.key)

  if (!current || current.resetAt <= now) {
    store.set(input.key, { count: 1, resetAt: now + input.windowMs })
    return { ok: true, retryAfterSec: Math.ceil(input.windowMs / 1000), remaining: input.limit - 1 }
  }

  if (current.count >= input.limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      remaining: 0
    }
  }

  current.count += 1
  store.set(input.key, current)
  return {
    ok: true,
    retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    remaining: input.limit - current.count
  }
}

export async function checkRateLimitDistributed(input: RateLimitInput): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    return checkRateLimit(input)
  }

  const now = Date.now()
  const bucket = Math.floor(now / input.windowMs)
  const redisKey = `rebar:ratelimit:${input.key}:${bucket}`

  try {
    const increased = await upstashCommand(["INCR", redisKey])
    const count = Number(increased ?? 0)

    if (count === 1) {
      await upstashCommand(["PEXPIRE", redisKey, input.windowMs])
    }

    const ttlRaw = await upstashCommand(["PTTL", redisKey])
    const ttlMs = Math.max(1, Number(ttlRaw ?? input.windowMs))
    const retryAfterSec = Math.max(1, Math.ceil(ttlMs / 1000))

    if (count > input.limit) {
      return {
        ok: false,
        retryAfterSec,
        remaining: 0
      }
    }

    return {
      ok: true,
      retryAfterSec,
      remaining: Math.max(0, input.limit - count)
    }
  } catch (err) {
    console.error("[rate-limit] Upstash failed, falling back to in-memory:", err instanceof Error ? err.message : err)
    return checkRateLimit(input)
  }
}

function normalizeClientIpCandidate(value: string | null): string | null {
  if (!value) {
    return null
  }

  const candidate = value.split(",")[0]?.trim()
  if (!candidate) {
    return null
  }

  let normalized = candidate

  if (normalized.startsWith("[")) {
    const closingIndex = normalized.indexOf("]")
    if (closingIndex <= 1) {
      return null
    }

    normalized = normalized.slice(1, closingIndex)
  } else if (normalized.includes(".") && normalized.includes(":")) {
    normalized = normalized.split(":")[0] ?? normalized
  }

  return isIP(normalized) ? normalized : null
}

export function resolveClientKey(headers: Headers): string {
  return (
    normalizeClientIpCandidate(headers.get("x-forwarded-for")) ??
    normalizeClientIpCandidate(headers.get("x-real-ip")) ??
    "unknown"
  )
}
