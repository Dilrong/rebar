"use client"

import { useEffect, useState } from "react"

type ReviewUndoBarProps = {
  t: (key: string, fallback?: string) => string
  open: boolean
  sequence: number
  onUndo: () => void
  onClose: () => void
}

export function ReviewUndoBar({ t, open, sequence, onUndo, onClose }: ReviewUndoBarProps) {
  const [progress, setProgress] = useState(1)

  useEffect(() => {
    if (!open) {
      return
    }

    setProgress(1)
    const raf = window.requestAnimationFrame(() => setProgress(0))
    return () => window.cancelAnimationFrame(raf)
  }, [open, sequence])

  if (!open) {
    return null
  }

  return (
    <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 z-[100] border-t-4 border-foreground bg-card md:bottom-0">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
        <div>
          <p className="font-mono text-xs font-bold uppercase text-foreground">
            {t("review.undoReady", "Review saved. Undo available")}
          </p>
          <p className="mt-1 font-mono text-[10px] font-bold uppercase text-muted-foreground">
            {t("toast.undo", "Undo")} · 4s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onUndo}
            className="inline-flex min-h-[44px] items-center justify-center border-4 border-foreground bg-foreground px-4 py-2 font-mono text-xs font-bold uppercase text-background shadow-brutal-sm transition-all hover:bg-accent hover:text-accent-foreground active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            {t("toast.undo", "Undo")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center justify-center border-4 border-foreground bg-background px-4 py-2 font-mono text-xs font-bold uppercase shadow-brutal-sm transition-all hover:bg-foreground hover:text-background active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            CLOSE
          </button>
        </div>
      </div>
      <div className="h-2 border-t-4 border-foreground bg-background">
        <div
          className="h-full origin-left bg-accent transition-transform duration-[4000ms] ease-linear"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
    </div>
  )
}
