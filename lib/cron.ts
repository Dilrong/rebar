import { timingSafeEqual } from "node:crypto"
import { fail } from "@/lib/http"

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) {
    return false
  }

  return timingSafeEqual(aBuf, bBuf)
}

export function verifyCronRequest(headers: Headers): { ok: true } | { ok: false; response: Response } {
  const expected = process.env.REBAR_CRON_SECRET ?? process.env.CRON_SECRET
  if (!expected) {
    console.error("Cron secret is not configured (REBAR_CRON_SECRET or CRON_SECRET)")
    return { ok: false, response: fail("Unauthorized", 401) }
  }

  const headerSecret = headers.get("x-cron-secret") ?? ""
  const bearer = (headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  if (safeEqual(headerSecret, expected) || safeEqual(bearer, expected)) {
    return { ok: true }
  }

  return { ok: false, response: fail("Unauthorized", 401) }
}
