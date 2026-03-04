function normalizeOrigin(value: string): string | null {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null
    }

    return parsed.origin
  } catch {
    return null
  }
}

function readAllowedWebOrigins(): Set<string> {
  const origins = new Set<string>()

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (siteUrl) {
    const normalized = normalizeOrigin(siteUrl)
    if (normalized) {
      origins.add(normalized)
    }
  }

  if (process.env.NODE_ENV === "development") {
    origins.add("http://localhost:3000")
  }

  return origins
}

function readAllowedExtensionIds(): Set<string> {
  const raw = process.env.REBAR_ALLOWED_EXTENSION_IDS ?? ""
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  )
}

function isAllowedChromeExtensionOrigin(origin: string): boolean {
  if (!origin.startsWith("chrome-extension://")) {
    return false
  }

  if (process.env.NODE_ENV === "development") {
    return true
  }

  if ((process.env.REBAR_ALLOW_ALL_EXTENSION_ORIGINS ?? "").toLowerCase() === "true") {
    return true
  }

  const extensionId = origin.slice("chrome-extension://".length).split("/")[0]
  if (!extensionId) {
    return false
  }

  const allowedIds = readAllowedExtensionIds()
  return allowedIds.has(extensionId)
}

export function isAllowedOrigin(origin: string | null, requestHost: string | null): boolean {
  if (!origin) {
    return true
  }

  const normalizedOrigin = normalizeOrigin(origin)

  if (normalizedOrigin && requestHost) {
    try {
      const hostOrigin = new URL(`http://${requestHost}`).host
      if (new URL(normalizedOrigin).host === hostOrigin) {
        return true
      }
    } catch {}
  }

  if (isAllowedChromeExtensionOrigin(origin)) {
    return true
  }

  if (!normalizedOrigin) {
    return false
  }

  return readAllowedWebOrigins().has(normalizedOrigin)
}
