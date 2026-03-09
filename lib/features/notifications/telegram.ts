import { safeEqual } from "@/lib/crypto"
import { postJsonDelivery, skippedDelivery, type NotificationDeliveryResult } from "./delivery"

function getTelegramBotToken() {
  return process.env.REBAR_TELEGRAM_BOT_TOKEN ?? null
}

function getTelegramChatId() {
  return process.env.REBAR_TELEGRAM_CHAT_ID ?? null
}

export function getTelegramIngestUserId() {
  return process.env.REBAR_TELEGRAM_INGEST_USER_ID ?? process.env.REBAR_NOTIFICATION_USER_ID ?? null
}

export function isTelegramWebhookAuthorized(headers: Headers) {
  const expected = process.env.REBAR_TELEGRAM_WEBHOOK_SECRET ?? null
  if (!expected) {
    return {
      ok: false as const,
      reason: "Telegram webhook secret is not configured",
      unconfigured: true as const
    }
  }

  const actual = headers.get("x-telegram-bot-api-secret-token") ?? ""
  if (!safeEqual(actual, expected)) {
    return {
      ok: false as const,
      reason: "Unauthorized"
    }
  }

  return { ok: true as const }
}

export async function sendTelegramMessage(text: string): Promise<TelegramSendResult> {
  const botToken = getTelegramBotToken()
  const chatId = getTelegramChatId()
  if (!botToken || !chatId) {
    return skippedDelivery()
  }

  return postJsonDelivery({
    url: `https://api.telegram.org/bot${botToken}/sendMessage`,
    payload: {
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    },
    errorLabel: "Telegram"
  })
}

type TelegramSendResult = NotificationDeliveryResult
