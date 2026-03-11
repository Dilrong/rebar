type RecordHighlightPopupProps = {
  open: boolean
  x: number
  y: number
  pending: boolean
  label: string
  onConfirm: () => void
}

export function RecordHighlightPopup({ open, x, y, pending, label, onConfirm }: RecordHighlightPopupProps) {
  if (!open) {
    return null
  }

  return (
    <div
      style={{
        position: "fixed",
        left: `clamp(1rem, ${x}px, calc(100vw - 1rem))`,
        top: `max(1rem, ${y}px)`,
        transform: "translate(-50%, -100%)",
        zIndex: 60,
        maxWidth: "calc(100vw - 2rem)"
      }}
    >
      <button
        type="button"
        onClick={onConfirm}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 border-4 border-foreground bg-accent px-4 py-2 text-center font-mono text-xs font-black uppercase text-white shadow-brutal-sm transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:bg-accent/80"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 11-6 6v3h9l3-3" />
          <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
        </svg>
        {pending ? "..." : label}
      </button>
    </div>
  )
}
