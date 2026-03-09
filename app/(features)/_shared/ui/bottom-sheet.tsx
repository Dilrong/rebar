"use client"

import { useEffect, useRef } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

type BottomSheetProps = {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: React.ReactNode
  className?: string
}

export function BottomSheet({ open, title, description, onClose, children, className }: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [onClose, open])

  useEffect(() => {
    if (!open) {
      return
    }

    panelRef.current?.focus()
  }, [open])

  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end bg-black/45 backdrop-blur-[2px] md:hidden"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bottom-sheet-title"
        aria-describedby={description ? "bottom-sheet-description" : undefined}
        tabIndex={-1}
        className={cn(
          "w-full rounded-t-[1.5rem] border-x-4 border-t-4 border-foreground bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_0_0_var(--shadow-color)] animate-[slide-up-fade_220ms_cubic-bezier(0.16,1,0.3,1)]",
          className
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4 border-b-2 border-foreground pb-3">
          <div className="min-w-0">
            <p id="bottom-sheet-title" className="font-black text-xl uppercase text-foreground">
              {title}
            </p>
            {description ? (
              <p id="bottom-sheet-description" className="mt-1 font-mono text-[10px] font-bold uppercase text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center border-2 border-foreground bg-background shadow-brutal-sm transition-all hover:bg-foreground hover:text-background active:translate-x-1 active:translate-y-1 active:shadow-none"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
