"use client"

import { Loader2 } from "lucide-react"
import { useI18n } from "@app-shared/i18n/i18n-provider"

export function LoadingSpinner({ className = "w-6 h-6" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />
}

export function LoadingDots() {
  return (
    <div className="flex items-center space-x-1">
      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]"></div>
      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]"></div>
      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"></div>
    </div>
  )
}

type PageLoadingProps = {
  messageKey?: string
  fallback?: string
}

export function PageLoading({
  messageKey = "loading.system",
  fallback = "System.Loading..."
}: PageLoadingProps = {}) {
  const { t } = useI18n()

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-4">
      <LoadingSpinner className="h-10 w-10 text-accent" />
      <p className="animate-pulse font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {t(messageKey, fallback)}
      </p>
    </div>
  )
}
