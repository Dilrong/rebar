const CURSOR_VERSION = "v1"

type CursorPayload = {
  v: string
  ts: string
}

export function encodeTimestampCursor(timestamp: string): string {
  const payload: CursorPayload = { v: CURSOR_VERSION, ts: timestamp }
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
}

export function decodeTimestampCursor(cursor: string): string | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8")
    const payload = JSON.parse(decoded) as CursorPayload
    if (payload.v !== CURSOR_VERSION || typeof payload.ts !== "string") {
      return null
    }

    const date = new Date(payload.ts)
    if (Number.isNaN(date.getTime())) {
      return null
    }

    return payload.ts
  } catch {
    return null
  }
}
