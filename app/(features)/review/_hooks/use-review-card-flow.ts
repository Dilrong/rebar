import { useEffect, useRef, useState } from "react"

type DecisionType = "ARCHIVE" | "ACT" | "DEFER"
type ActionType = "EXPERIMENT" | "SHARE" | "TODO"
type DeferReason = "NEED_INFO" | "LOW_CONFIDENCE" | "NO_TIME"

export type DecisionPayload = {
  id: string
  decisionType: DecisionType
  actionType?: ActionType
  deferReason?: DeferReason
}

type CardTransitionPhase = "idle" | "stamping" | "exiting" | "entering"

type CardTransitionState = {
  phase: CardTransitionPhase
  stampLabel: string | null
  recordId: string | null
}

type UseReviewCardFlowOptions = {
  firstId: string | null
  mutationPending: boolean
  undoPending: boolean
  undoTargetId: string | null
  onCommitDecision: (payload: DecisionPayload) => void
  onUndo: (id: string) => void
}

export function useReviewCardFlow({ firstId, mutationPending, undoPending, undoTargetId, onCommitDecision, onUndo }: UseReviewCardFlowOptions) {
  const [actExpanded, setActExpanded] = useState(false)
  const [deferExpanded, setDeferExpanded] = useState(false)
  const [cardTransition, setCardTransition] = useState<CardTransitionState>({
    phase: "idle",
    stampLabel: null,
    recordId: null
  })
  const transitionTimerRef = useRef<number | null>(null)
  const mutationTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current)
      }
      if (mutationTimerRef.current) {
        window.clearTimeout(mutationTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    setCardTransition((current) => {
      if (!firstId) {
        return { phase: "idle", stampLabel: null, recordId: null }
      }

      if (current.recordId && current.recordId !== firstId) {
        return { phase: "entering", stampLabel: null, recordId: firstId }
      }

      if (current.phase === "exiting" && current.recordId === firstId) {
        return { phase: "idle", stampLabel: null, recordId: firstId }
      }

      return current.recordId ? current : { phase: "idle", stampLabel: null, recordId: firstId }
    })
  }, [firstId])

  useEffect(() => {
    if (cardTransition.phase !== "entering") {
      return
    }

    const timer = window.setTimeout(() => {
      setCardTransition((current) => (current.phase === "entering" ? { phase: "idle", stampLabel: null, recordId: current.recordId } : current))
    }, 200)

    return () => window.clearTimeout(timer)
  }, [cardTransition.phase])

  const closePanels = () => {
    setActExpanded(false)
    setDeferExpanded(false)
  }

  const toggleActPanel = () => {
    setActExpanded((prev) => {
      const next = !prev
      if (next) {
        setDeferExpanded(false)
      }
      return next
    })
  }

  const toggleDeferPanel = () => {
    setDeferExpanded((prev) => {
      const next = !prev
      if (next) {
        setActExpanded(false)
      }
      return next
    })
  }

  const triggerDecision = (payload: DecisionPayload, stampLabel: string) => {
    if (mutationPending || undoPending || cardTransition.phase !== "idle") {
      return
    }

    closePanels()
    setCardTransition({ phase: "stamping", stampLabel, recordId: payload.id })

    if (transitionTimerRef.current) {
      window.clearTimeout(transitionTimerRef.current)
    }
    if (mutationTimerRef.current) {
      window.clearTimeout(mutationTimerRef.current)
    }

    transitionTimerRef.current = window.setTimeout(() => {
      setCardTransition((current) => (current.recordId === payload.id ? { ...current, phase: "exiting" } : current))

      mutationTimerRef.current = window.setTimeout(() => {
        onCommitDecision(payload)
      }, 200)
    }, 300)
  }

  const resetCardTransition = (recordId: string | null) => {
    setCardTransition({ phase: "idle", stampLabel: null, recordId })
  }

  useEffect(() => {
    if (!firstId) {
      return
    }

    const currentId = firstId
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || mutationPending || undoPending) {
        return
      }

      const target = event.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return
      }

      const key = event.key.toLowerCase()
      if (key === "a") {
        event.preventDefault()
        triggerDecision({ id: currentId, decisionType: "ARCHIVE" }, "ARCHIVED")
      } else if (key === "s") {
        event.preventDefault()
        triggerDecision({ id: currentId, decisionType: "ACT", actionType: "TODO" }, "PINNED")
      } else if (key === "d") {
        event.preventDefault()
        triggerDecision({ id: currentId, decisionType: "DEFER", deferReason: "NO_TIME" }, "DEFERRED")
      } else if (key === "u" && undoTargetId) {
        event.preventDefault()
        onUndo(undoTargetId)
      } else if (key === "escape") {
        closePanels()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [firstId, mutationPending, onUndo, undoPending, undoTargetId, cardTransition.phase])

  return {
    actExpanded,
    deferExpanded,
    cardTransition,
    toggleActPanel,
    toggleDeferPanel,
    triggerDecision,
    resetCardTransition,
    closePanels
  }
}
