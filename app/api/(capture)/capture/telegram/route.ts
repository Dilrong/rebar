import { z } from "zod"
import { fail, ok } from "@/lib/http"
import { processIngest } from "@feature-lib/capture/ingest"
import { getTelegramIngestUserId, isTelegramWebhookAuthorized } from "@feature-lib/notifications/telegram"

const TelegramEntitySchema = z.object({
  type: z.string(),
  offset: z.number().int().nonnegative(),
  length: z.number().int().nonnegative(),
  url: z.string().optional()
})

const TelegramMessageSchema = z.object({
  message_id: z.number().int(),
  text: z.string().optional(),
  caption: z.string().optional(),
  entities: z.array(TelegramEntitySchema).optional(),
  caption_entities: z.array(TelegramEntitySchema).optional(),
  chat: z.object({
    id: z.union([z.number().int(), z.string()]),
    type: z.string().optional(),
    title: z.string().optional(),
    username: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional()
  }),
  from: z.object({
    id: z.union([z.number().int(), z.string()]).optional(),
    username: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional()
  }).optional()
})

const TelegramUpdateSchema = z.object({
  update_id: z.number().int().optional(),
  message: TelegramMessageSchema.optional(),
  edited_message: TelegramMessageSchema.optional(),
  channel_post: TelegramMessageSchema.optional(),
  edited_channel_post: TelegramMessageSchema.optional()
})

function extractText(message: z.infer<typeof TelegramMessageSchema>) {
  return (message.text ?? message.caption ?? "").trim()
}

function extractEntities(message: z.infer<typeof TelegramMessageSchema>) {
  return message.entities ?? message.caption_entities ?? []
}

function normalizeEntityUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  return trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`
}

function findFirstUrl(text: string, entities: Array<z.infer<typeof TelegramEntitySchema>>) {
  for (const entity of entities) {
    if (entity.type === "text_link" && entity.url) {
      return normalizeEntityUrl(entity.url)
    }

    if (entity.type !== "url") {
      continue
    }

    const value = normalizeEntityUrl(text.slice(entity.offset, entity.offset + entity.length))
    if (value) {
      return value
    }
  }

  const matched = text.match(/https?:\/\/\S+/i)
  return matched?.[0] ?? null
}

function compactText(text: string, url: string | null) {
  const trimmed = url ? text.replace(url, " ").replace(/\s+/g, " ").trim() : text.trim()
  return trimmed.length > 0 ? trimmed : null
}

function resolveSourceTitle(message: z.infer<typeof TelegramMessageSchema>) {
  const chat = message.chat
  const sender = message.from
  const chatLabel =
    chat.title?.trim() ||
    chat.username?.trim() ||
    [chat.first_name, chat.last_name].filter(Boolean).join(" ").trim()

  if (chatLabel) {
    return `Telegram: ${chatLabel}`
  }

  const senderLabel =
    sender?.username?.trim() ||
    [sender?.first_name, sender?.last_name].filter(Boolean).join(" ").trim()

  return senderLabel ? `Telegram: ${senderLabel}` : "Telegram"
}

export async function POST(request: Request) {
  const authorization = isTelegramWebhookAuthorized(request.headers)
  if (!authorization.ok) {
    if ("unconfigured" in authorization && authorization.unconfigured) {
      return ok({ ignored: true, reason: "Webhook secret not configured" })
    }
    return fail(authorization.reason, 401)
  }

  const userId = getTelegramIngestUserId()
  if (!userId) {
    return fail("Telegram ingest user is not configured", 500)
  }

  const body = await request.json().catch(() => null)
  const parsed = TelegramUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 400)
  }

  const message = parsed.data.message ?? parsed.data.edited_message ?? parsed.data.channel_post ?? parsed.data.edited_channel_post
  if (!message) {
    return ok({ ignored: true, reason: "No message payload" })
  }

  const rawText = extractText(message)
  if (!rawText) {
    return ok({ ignored: true, reason: "No text content" })
  }

  const url = findFirstUrl(rawText, extractEntities(message))
  const content = compactText(rawText, url) ?? rawText
  const kind = url && content === url ? "link" : "note"

  try {
    const result = await processIngest(
      userId,
      {
        items: [
          {
            content,
            url: url ?? undefined,
            kind,
            source_title: resolveSourceTitle(message),
            source_type: url ? "service" : "manual",
            source_service: "telegram",
            source_identity: `${message.chat.id}:${message.message_id}`,
            external_source_id: String(message.chat.id),
            external_item_id: String(message.message_id),
            tags: ["telegram"]
          }
        ]
      },
      { importChannel: "share" }
    )

    return ok({
      ...result,
      source: "telegram"
    })
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Ingest failed", 500)
  }
}
