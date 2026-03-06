import { NextResponse } from "next/server"

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init)
}

export function fail(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

export function internalError(context: string, error: unknown): NextResponse {
  console.error(`[${context}]`, error instanceof Error ? error.message : error)
  return NextResponse.json({ error: "Internal error" }, { status: 500 })
}

export function rateLimited(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: "Too Many Requests" },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec)
      }
    }
  )
}
