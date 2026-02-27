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

export function checkRateLimit(input: RateLimitInput): RateLimitResult {
  const now = Date.now()

  if (store.size > 1000) {
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(key)
      }
    }
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

export function resolveClientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) {
      return first
    }
  }

  const realIp = headers.get("x-real-ip")
  if (realIp) {
    return realIp
  }

  return "unknown"
}
