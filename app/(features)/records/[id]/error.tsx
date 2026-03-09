"use client"

import { RouteErrorState } from "@shared/ui/route-error-state"

export default function RecordDetailError({
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <RouteErrorState reset={reset} />
}
