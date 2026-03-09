"use client"

import { RouteErrorState } from "@shared/ui/route-error-state"

export default function ReviewError({
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <RouteErrorState reset={reset} />
}
