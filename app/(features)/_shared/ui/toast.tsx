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
      ? "border-accent bg-accent text-accent-foreground"
      : tone === "error"
        ? "border-destructive bg-destructive text-destructive-foreground"
        : "border-foreground bg-foreground text-background"

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] left-3 right-3 z-[100] border-4 p-4 shadow-brutal animate-slide-in-right md:bottom-4 md:left-auto md:right-4 md:max-w-sm ${toneClass}`}
    >
      <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase">
        <span className="flex-1">{message}</span>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="border-2 border-current px-3 py-1 font-mono text-xs font-black uppercase hover:bg-current hover:text-background active:translate-x-[2px] active:translate-y-[2px] transition-all duration-200"
          >
            {actionLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="ml-2 border-2 border-current px-2 py-1 font-mono text-xs font-black uppercase hover:bg-current hover:text-background active:translate-x-[2px] active:translate-y-[2px] transition-all duration-200"
        >
          X
        </button>
      </div>
    </div>
  )
}
