type ToastProps = {
  message: string
  actionLabel?: string
  onAction?: () => void
  onClose: () => void
  tone?: "default" | "success" | "error"
}

export function Toast({ message, actionLabel, onAction, onClose, tone = "default" }: ToastProps) {
  const toneClass =
    tone === "success"
      ? "border-accent bg-accent text-white"
      : tone === "error"
        ? "border-destructive bg-destructive text-white"
        : "border-foreground bg-foreground text-background"

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 right-4 z-50 max-w-sm border-4 p-4 shadow-brutal animate-slide-in-right ${toneClass}`}
    >
      <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase">
        <span className="flex-1">{message}</span>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="border-2 border-current px-3 py-1 font-mono text-xs font-black uppercase active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-transform"
          >
            {actionLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="ml-2 border-2 border-current px-2 py-1 font-mono text-xs font-black uppercase active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-transform"
        >
          X
        </button>
      </div>
    </div>
  )
}
