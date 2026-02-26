import type { RecordRow } from "@/lib/types"

type Translate = (key: string, fallback?: string) => string

export function getStateLabel(state: RecordRow["state"], t: Translate) {
  if (state === "INBOX") {
    return t("state.inbox", "Inbox")
  }

  if (state === "ACTIVE") {
    return t("state.active", "Active")
  }

  if (state === "PINNED") {
    return t("state.pinned", "Pinned")
  }

  if (state === "ARCHIVED") {
    return t("state.archived", "Archived")
  }

  return t("state.trashed", "Trash")
}
