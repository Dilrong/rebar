import { useEffect, useRef, useState } from "react"

type CaptureToastKind = "ingested" | "ocrFilled" | "retryDone"

const TOAST_DURATION_MS = 5000

export function useCaptureToast() {
  const [showSavedToast, setShowSavedToast] = useState(false)
  const [toastKind, setToastKind] = useState<CaptureToastKind>("ingested")
  const [latestSavedRecordId, setLatestSavedRecordId] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  const openToast = (kind: CaptureToastKind, recordId: string | null = null) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
    }

    setToastKind(kind)
    setLatestSavedRecordId(recordId)
    setShowSavedToast(true)
    toastTimerRef.current = window.setTimeout(() => {
      setShowSavedToast(false)
      setLatestSavedRecordId(null)
      toastTimerRef.current = null
    }, TOAST_DURATION_MS)
  }

  const closeToast = () => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = null
    }
    setShowSavedToast(false)
    setLatestSavedRecordId(null)
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  return {
    showSavedToast,
    toastKind,
    latestSavedRecordId,
    openToast,
    closeToast
  }
}
