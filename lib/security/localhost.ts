function parseHostCandidate(value: string): string {
  const first = value.split(",")[0]?.trim().toLowerCase() ?? ""
  if (!first) {
    return ""
  }

  if (first.startsWith("[")) {
    const end = first.indexOf("]")
    if (end <= 1) {
      return ""
    }

    return first.slice(1, end)
  }

  return first.split(":")[0] ?? ""
}

export function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase()
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1"
}

export function isLocalRequestHost(value: string | null | undefined): boolean {
  if (!value) {
    return false
  }

  return isLoopbackHostname(parseHostCandidate(value))
}
