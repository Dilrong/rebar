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
    <div className={`fixed bottom-4 right-4 z-50 max-w-sm border-2 p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${toneClass}`}>
      <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase">
        <span className="flex-1">{message}</span>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="border border-current px-2 py-1 font-mono text-[10px] font-bold uppercase"
          >
            {actionLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="border border-current px-1.5 py-1 font-mono text-[10px] font-bold uppercase"
        >
          X
        </button>
      </div>
    </div>
  )
}
