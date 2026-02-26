import { NextResponse } from "next/server"

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init)
}

export function fail(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status })
}
