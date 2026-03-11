import type { IngestItemInput } from "./external-import"

export type CsvPreview = {
  totalRows: number
  importableRows: number
  readwiseDetected: boolean
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const ch = line[index]

    if (ch === '"') {
      const next = line[index + 1]
      if (inQuotes && next === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (ch === "," && !inQuotes) {
      cells.push(current.trim())
      current = ""
      continue
    }

    current += ch
  }

  cells.push(current.trim())
  return cells
}

function normalizeCsvHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function firstNonEmpty(...values: Array<string | undefined>) {
  for (const value of values) {
    if (!value) {
      continue
    }

    const trimmed = value.trim()
    if (trimmed.length > 0) {
      return trimmed
    }
  }

  return ""
}

export function parseCsvItems(raw: string): IngestItemInput[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    return []
  }

  const headers = splitCsvLine(lines[0]).map((header) => normalizeCsvHeader(header))
  const items: IngestItemInput[] = []

  for (const line of lines.slice(1)) {
    const values = splitCsvLine(line)
    const row = new Map<string, string>()

    headers.forEach((header, index) => {
      row.set(header, values[index] ?? "")
    })

    const highlight = firstNonEmpty(row.get("content"), row.get("text"), row.get("highlight"))
    const note = firstNonEmpty(row.get("note"))
    const content = highlight || note

    if (!content) {
      continue
    }

    const tagsRaw = row.get("tags") ?? ""
    const tags = tagsRaw
      .split(/[|,]/)
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)

    const bookTitle = firstNonEmpty(row.get("booktitle"), row.get("title"), row.get("sourcetitle"))
    const bookAuthor = firstNonEmpty(row.get("bookauthor"), row.get("author"))
    const url = firstNonEmpty(row.get("url"), row.get("sourceurl"))
    const rawKind = firstNonEmpty(row.get("kind")).toLowerCase()

    const kind: IngestItemInput["kind"] | undefined =
      rawKind === "quote" || rawKind === "note" || rawKind === "link" || rawKind === "ai"
        ? rawKind
        : highlight
          ? "quote"
          : "note"

    items.push({
      content,
      note: highlight && note ? note : undefined,
      source_title: !bookTitle && !bookAuthor ? firstNonEmpty(row.get("title"), row.get("sourcetitle")) || undefined : undefined,
      book_title: bookTitle || undefined,
      book_author: bookAuthor || undefined,
      url: url || undefined,
      kind,
      source_type: bookTitle || bookAuthor ? "book" : url ? "article" : "unknown",
      tags: tags.length > 0 ? tags : undefined
    })
  }

  return items
}

export function parseCsvPreview(raw: string): CsvPreview {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    return { totalRows: 0, importableRows: 0, readwiseDetected: false }
  }

  const headers = splitCsvLine(lines[0]).map((header) => normalizeCsvHeader(header))
  const readwiseDetected = ["highlight", "booktitle", "bookauthor", "amazonbookid", "highlightedat"].every((key) => headers.includes(key))

  let importableRows = 0
  for (const line of lines.slice(1)) {
    const values = splitCsvLine(line)
    const row = new Map<string, string>()

    headers.forEach((header, index) => {
      row.set(header, values[index] ?? "")
    })

    const highlight = firstNonEmpty(row.get("content"), row.get("text"), row.get("highlight"))
    const note = firstNonEmpty(row.get("note"))
    if (highlight || note) {
      importableRows += 1
    }
  }

  return {
    totalRows: Math.max(lines.length - 1, 0),
    importableRows,
    readwiseDetected
  }
}
