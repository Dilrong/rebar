import type { ReviewAction } from "@/lib/schemas"

export const MAX_INTERVAL_DAYS = 90

export function calcNextInterval(current: number, action: ReviewAction): number {
  if (action === "resurface") {
    return 1
  }

  const safe = Math.max(1, Math.round(current))
  return Math.min(safe * 2, MAX_INTERVAL_DAYS)
}
