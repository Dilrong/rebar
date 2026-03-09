import { postJsonDelivery, skippedDelivery, type NotificationDeliveryResult } from "./delivery"

type OutboundWebhookEvent = {
  type: string
  occurred_at: string
  user_id?: string | null
  data: unknown
}

type RecordStateChangedPayload = {
  userId: string
  recordId: string
  previousState: string
  nextState: string
  source: "review" | "record.patch" | "records.bulk"
}

function getWebhookUrl(kind: "export" | "notification") {
  const primary = kind === "export"
    ? process.env.REBAR_EXPORT_WEBHOOK_URL
    : process.env.REBAR_NOTIFICATION_WEBHOOK_URL
  return primary ?? process.env.REBAR_WEBHOOK_URL ?? null
}

function getWebhookSecret(kind: "export" | "notification") {
  const primary = kind === "export"
    ? process.env.REBAR_EXPORT_WEBHOOK_SECRET
    : process.env.REBAR_NOTIFICATION_WEBHOOK_SECRET
  return primary ?? process.env.REBAR_WEBHOOK_SECRET ?? null
}

export async function sendWebhookEvent(kind: "export" | "notification", event: OutboundWebhookEvent): Promise<WebhookDeliveryResult> {
  const url = getWebhookUrl(kind)
  if (!url) {
    return skippedDelivery()
  }

  return postJsonDelivery({
    url,
    headers: secretHeader(getWebhookSecret(kind)),
    payload: event,
    errorLabel: "Webhook"
  })
}

export async function sendRecordStateChangedEvent(payload: RecordStateChangedPayload): Promise<WebhookDeliveryResult> {
  return sendWebhookEvent("export", {
    type: "record.state_changed",
    occurred_at: new Date().toISOString(),
    user_id: payload.userId,
    data: {
      record_id: payload.recordId,
      previous_state: payload.previousState,
      next_state: payload.nextState,
      source: payload.source
    }
  })
}

function secretHeader(secret: string | null) {
  return secret ? { "x-rebar-webhook-secret": secret } : undefined
}

type WebhookDeliveryResult = NotificationDeliveryResult
