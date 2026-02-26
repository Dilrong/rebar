type ConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md border-4 border-foreground bg-card p-5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <h3 className="mb-3 border-b-2 border-foreground pb-2 font-black text-xl uppercase text-foreground">{title}</h3>
        <p className="mb-4 font-mono text-xs font-bold text-foreground">{description}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase text-foreground"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="border-2 border-foreground bg-foreground px-3 py-2 font-mono text-xs font-bold uppercase text-background"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
