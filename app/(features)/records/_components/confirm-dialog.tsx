import { useEffect, useRef } from "react"

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
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  const confirmRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const previousActive = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onCancel()
        return
      }

      if (event.key !== "Tab") {
        return
      }

      const focusable = [cancelRef.current, confirmRef.current].filter(
        (node): node is HTMLButtonElement => node !== null
      )
      if (focusable.length === 0) {
        return
      }

      const currentIndex = focusable.findIndex((node) => node === document.activeElement)
      const nextIndex = event.shiftKey
        ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
        : (currentIndex + 1) % focusable.length

      event.preventDefault()
      focusable[nextIndex].focus()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      previousActive?.focus()
    }
  }, [onCancel, open])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="w-full max-w-md border-4 border-foreground bg-card p-5 shadow-brutal"
      >
        <h3 id="confirm-dialog-title" className="mb-3 border-b-2 border-foreground pb-2 font-black text-xl uppercase text-foreground">{title}</h3>
        <p id="confirm-dialog-description" className="mb-4 font-mono text-xs font-bold text-foreground">{description}</p>
        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase text-foreground"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
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
