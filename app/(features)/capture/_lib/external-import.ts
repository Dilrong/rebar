export type IngestItemInput = {
  content: string
  note?: string
  title?: string
  source_title?: string
  book_title?: string
  book_author?: string
  author?: string
  url?: string
  source_url?: string
  anchor?: string
  tags?: string[]
  kind?: "quote" | "note" | "link" | "ai"
  source_type?: "book" | "article" | "service" | "manual" | "ai" | "unknown"
  source_service?: string
  source_identity?: string
  external_source_id?: string
  external_item_id?: string
  adopted_from_ai?: boolean
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const result: string[] = []
  for (const tag of value) {
    if (typeof tag === "string") {
      const trimmed = tag.trim()
      if (trimmed) {
        result.push(trimmed)
      }
      continue
    }

    if (isObject(tag)) {
      const name = asString(tag.name)
      if (name) {
        result.push(name)
      }
    }
  }

  return result.length > 0 ? Array.from(new Set(result)) : undefined
}

function normalizeCategory(value: unknown) {
  return asString(value)?.toLowerCase()
}

function isReadwiseShape(value: Record<string, unknown>, category: string | undefined) {
  return Boolean(
    category ||
      asString(value.readwise_url) ||
      asString(value.readwiseUrl) ||
      asString(value.highlighted_at) ||
      asString(value.highlightedAt) ||
      asString(value.book_id) ||
      asString(value.bookId) ||
      asString(value.location) ||
      asString(value.location_type) ||
      asString(value.locationType)
  )
}

function resolveHighlightContent(value: Record<string, unknown>) {
  return (
    asString(value.highlight) ??
    asString(value.highlighted_text) ??
    asString(value.highlightedText) ??
    asString(value.content) ??
    asString(value.text) ??
    asString(value.summary)
  )
}

function resolveNote(value: Record<string, unknown>) {
  return asString(value.note) ?? asString(value.comment) ?? asString(value.annotation_note) ?? asString(value.annotationNote)
}

function resolveBookTitle(value: Record<string, unknown>, category: string | undefined) {
  const explicit = asString(value.book_title) ?? asString(value.bookTitle) ?? asString(value.book)
  if (explicit) {
    return explicit
  }

  const title = asString(value.title)
  const hasBookSignals =
    category === "books" ||
    Boolean(asString(value.book_author) ?? asString(value.bookAuthor) ?? asString(value.bookauthor))

  return hasBookSignals ? title : undefined
}

function resolveBookAuthor(value: Record<string, unknown>, bookTitle: string | undefined) {
  return (
    asString(value.book_author) ??
    asString(value.bookAuthor) ??
    asString(value.bookauthor) ??
    (bookTitle ? asString(value.author) : undefined)
  )
}

function resolveSourceTitle(value: Record<string, unknown>, bookTitle: string | undefined) {
  return (
    asString(value.source_title) ??
    asString(value.sourceTitle) ??
    asString(value.article_title) ??
    asString(value.articleTitle) ??
    asString(value.document_title) ??
    asString(value.documentTitle) ??
    (bookTitle ? undefined : asString(value.title))
  )
}

function resolveSourceUrl(value: Record<string, unknown>) {
  return (
    asString(value.source_url) ??
    asString(value.sourceUrl) ??
    asString(value.book_url) ??
    asString(value.bookUrl) ??
    asString(value.article_url) ??
    asString(value.articleUrl) ??
    asString(value.source) ??
    asString(value.href)
  )
}

function resolveUrl(value: Record<string, unknown>, sourceUrl: string | undefined) {
  return (
    sourceUrl ??
    asString(value.url) ??
    asString(value.highlight_url) ??
    asString(value.highlightUrl) ??
    asString(value.readwise_url) ??
    asString(value.readwiseUrl)
  )
}

function resolveAnchor(value: Record<string, unknown>) {
  const explicitAnchor = asString(value.anchor)
  if (explicitAnchor) {
    return explicitAnchor
  }

  const location = asString(value.location)
  if (!location) {
    return undefined
  }

  const locationType = asString(value.location_type) ?? asString(value.locationType)
  return locationType ? `${location} (${locationType})` : location
}

function resolveSourceType(
  value: Record<string, unknown>,
  category: string | undefined,
  bookTitle: string | undefined,
  url: string | undefined
): IngestItemInput["source_type"] | undefined {
  const sourceType = asString(value.source_type) ?? asString(value.sourceType)
  if (
    sourceType === "book" ||
    sourceType === "article" ||
    sourceType === "service" ||
    sourceType === "manual" ||
    sourceType === "ai" ||
    sourceType === "unknown"
  ) {
    return sourceType
  }

  if (bookTitle || category === "books") {
    return "book"
  }

  if (category === "articles" || category === "article") {
    return "article"
  }

  if (category === "tweets" || category === "podcasts" || category === "videos") {
    return "service"
  }

  return url ? "article" : undefined
}

function resolveSourceService(value: Record<string, unknown>, readwiseShape: boolean) {
  return asString(value.source_service) ?? asString(value.service) ?? asString(value.provider) ?? (readwiseShape ? "readwise" : undefined)
}

function resolveSourceIdentity(value: Record<string, unknown>) {
  return (
    asString(value.source_identity) ??
    asString(value.sourceIdentity) ??
    asString(value.readwise_url) ??
    asString(value.readwiseUrl)
  )
}

function resolveExternalSourceId(value: Record<string, unknown>) {
  return (
    asString(value.external_source_id) ??
    asString(value.externalSourceId) ??
    asString(value.book_id) ??
    asString(value.bookId)
  )
}

function resolveExternalItemId(value: Record<string, unknown>, readwiseShape: boolean) {
  return (
    asString(value.external_item_id) ??
    asString(value.externalItemId) ??
    asString(value.highlight_id) ??
    asString(value.highlightId) ??
    (readwiseShape ? asString(value.id) : undefined)
  )
}

function toIngestItem(value: unknown): IngestItemInput | null {
  if (typeof value === "string") {
    const content = value.trim()
    return content ? { content } : null
  }

  if (!isObject(value)) {
    return null
  }

  const category = normalizeCategory(value.category)
  const readwiseShape = isReadwiseShape(value, category)
  const content = resolveHighlightContent(value)
  const note = resolveNote(value)
  const resolvedContent = content ?? note

  if (!resolvedContent) {
    return null
  }

  const item: IngestItemInput = { content: resolvedContent }
  const bookTitle = resolveBookTitle(value, category)
  const bookAuthor = resolveBookAuthor(value, bookTitle)
  const sourceTitle = resolveSourceTitle(value, bookTitle)
  const sourceUrl = resolveSourceUrl(value)
  const url = resolveUrl(value, sourceUrl)
  const anchor = resolveAnchor(value)

  if (bookTitle) {
    item.book_title = bookTitle
  }
  if (bookAuthor) {
    item.book_author = bookAuthor
  }
  if (sourceTitle) {
    item.source_title = sourceTitle
  }
  if (url) {
    item.url = url
  }
  if (sourceUrl) {
    item.source_url = sourceUrl
  }
  if (anchor) {
    item.anchor = anchor
  }

  const author = bookAuthor ? undefined : asString(value.author)
  if (author) {
    item.author = author
  }

  const tags = normalizeTags(value.tags)
  if (tags) {
    item.tags = tags
  }

  const sourceType = resolveSourceType(value, category, bookTitle, url)
  if (sourceType) {
    item.source_type = sourceType
  }

  const sourceService = resolveSourceService(value, readwiseShape)
  if (sourceService) {
    item.source_service = sourceService
  }

  const sourceIdentity = resolveSourceIdentity(value)
  if (sourceIdentity) {
    item.source_identity = sourceIdentity
  }

  const externalSourceId = resolveExternalSourceId(value)
  if (externalSourceId) {
    item.external_source_id = externalSourceId
  }

  const externalItemId = resolveExternalItemId(value, readwiseShape)
  if (externalItemId) {
    item.external_item_id = externalItemId
  }

  if (typeof value.adopted_from_ai === "boolean") {
    item.adopted_from_ai = value.adopted_from_ai
  }

  if (content && note) {
    item.note = note
  }

  return item
}

export function parseExternalItems(raw: string): IngestItemInput[] {
  const parsed = JSON.parse(raw) as unknown
  let source: unknown[] = []

  if (Array.isArray(parsed)) {
    source = parsed
  } else if (isObject(parsed)) {
    const highlights = parsed.highlights
    const results = parsed.results
    const items = parsed.items

    if (Array.isArray(highlights)) {
      source = highlights
    } else if (Array.isArray(results)) {
      source = results
    } else if (Array.isArray(items)) {
      source = items
    } else {
      source = [parsed]
    }
  }

  return source.map(toIngestItem).filter((item): item is IngestItemInput => item !== null)
}
