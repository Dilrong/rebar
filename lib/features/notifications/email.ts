import { postJsonDelivery, skippedDelivery, type NotificationDeliveryResult } from "./delivery"

type EmailSendParams = {
  subject: string
  text: string
}

function getEmailApiKey() {
  return process.env.REBAR_RESEND_API_KEY ?? process.env.RESEND_API_KEY ?? null
}

function getEmailSender() {
  return process.env.REBAR_NOTIFICATION_EMAIL_FROM ?? null
}

function getEmailRecipient() {
  return process.env.REBAR_NOTIFICATION_EMAIL_TO ?? null
}

function getEmailReplyTo() {
  return process.env.REBAR_NOTIFICATION_EMAIL_REPLY_TO ?? null
}

function getEmailApiUrl() {
  return process.env.REBAR_EMAIL_API_URL ?? "https://api.resend.com/emails"
}

export async function sendEmailMessage({ subject, text }: EmailSendParams): Promise<EmailSendResult> {
  const apiKey = getEmailApiKey()
  const from = getEmailSender()
  const to = getEmailRecipient()
  if (!apiKey || !from || !to) {
    return skippedDelivery()
  }

  return postJsonDelivery({
    url: getEmailApiUrl(),
    headers: {
      authorization: `Bearer ${apiKey}`
    },
    payload: {
      from,
      to: [to],
      subject,
      text,
      ...(getEmailReplyTo() ? { reply_to: getEmailReplyTo() } : {})
    },
    errorLabel: "Email provider"
  })
}

type EmailSendResult = NotificationDeliveryResult
