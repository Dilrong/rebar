import { verifyCronRequest } from "@/lib/cron"
import { fail, ok } from "@/lib/http"
import { sendWeeklyDigest } from "@feature-lib/review/digest"

function getNotificationUserId() {
  return process.env.REBAR_NOTIFICATION_USER_ID ?? process.env.REBAR_TELEGRAM_INGEST_USER_ID ?? null
}

export async function POST(request: Request) {
  const verified = verifyCronRequest(request.headers)
  if (!verified.ok) {
    return verified.response
  }

  const userId = getNotificationUserId()
  if (!userId) {
    return fail("Notification user is not configured", 500)
  }

  const result = await sendWeeklyDigest(userId)
  if (!result.ok) {
    return fail(result.error, 500)
  }

  return ok(result)
}
