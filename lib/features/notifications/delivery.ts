export type NotificationDeliveryResult =
  | { ok: true; skipped: true }
  | { ok: true; status: number }
  | { ok: false; status?: number; error: string }

type PostJsonDeliveryParams = {
  url: string
  headers?: HeadersInit
  payload: unknown
  errorLabel: string
  timeoutMs?: number
}

function getTimeoutSignal(timeoutMs: number) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs)
  }

  return undefined
}

export function skippedDelivery(): NotificationDeliveryResult {
  return { ok: true, skipped: true }
}

export function deliverySucceeded(result: NotificationDeliveryResult) {
  return result.ok && !("skipped" in result && result.skipped)
}

export async function postJsonDelivery({
  url,
  headers,
  payload,
  errorLabel,
  timeoutMs = 10_000
}: PostJsonDeliveryParams): Promise<NotificationDeliveryResult> {
  try {
    const signal = getTimeoutSignal(timeoutMs)
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers
      },
      body: JSON.stringify(payload),
      ...(signal ? { signal } : {})
    })

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `${errorLabel} responded with ${response.status}`
      }
    }

    return { ok: true, status: response.status }
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        ok: false,
        error: `${errorLabel} timed out`
      }
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : `${errorLabel} delivery failed`
    }
  }
}
