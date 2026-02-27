import { NextResponse } from "next/server"

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init)
}

export function fail(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status })
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
