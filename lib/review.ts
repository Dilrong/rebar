import type { ReviewAction } from "@/lib/schemas"

export const MAX_INTERVAL_DAYS = 90

export function calcNextInterval(current: number, action: ReviewAction): number {
  if (action === "resurface") {
    return 1
  }

  return Math.min(Math.round(current * 2), MAX_INTERVAL_DAYS)
}
