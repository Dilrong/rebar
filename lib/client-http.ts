import { getSupabaseBrowser } from "@/lib/supabase-browser"

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)

  if (typeof window !== "undefined" && !headers.has("Authorization")) {
    const supabase = getSupabaseBrowser()
    const {
      data: { session }
    } = await supabase.auth.getSession()

    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`)
    }
  }

  const devUserId = process.env.NEXT_PUBLIC_DEV_USER_ID
  if (
    process.env.NODE_ENV === "development" &&
    devUserId &&
    !headers.has("x-user-id") &&
    !headers.has("Authorization") &&
    typeof window !== "undefined" &&
    window.location.hostname === "localhost"
  ) {
    headers.set("x-user-id", devUserId)
  }

  const response = await fetch(input, {
    ...init,
    headers
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "Request failed"

    const error = new Error(message) as Error & { status?: number; payload?: unknown }
    error.status = response.status
    error.payload = data
    throw error
  }

  return data as T
}
