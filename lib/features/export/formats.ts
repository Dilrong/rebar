export const EXPORT_FORMATS = ["markdown", "obsidian", "json", "csv", "logseq"] as const

export type ExportFormat = (typeof EXPORT_FORMATS)[number]

function getSinceSuffix(since: string | null | undefined) {
  const match = since?.match(/^\d{4}-\d{2}-\d{2}/)
  return match ? `-since-${match[0]}` : ""
}

export function isExportFormat(value: string): value is ExportFormat {
  return EXPORT_FORMATS.includes(value as ExportFormat)
}

export function buildExportFilename(format: ExportFormat, today: string, since?: string | null) {
  const sinceSuffix = getSinceSuffix(since)

  switch (format) {
    case "obsidian":
      return `rebar-obsidian-export-${today}${sinceSuffix}.md`
    case "json":
      return `rebar-export-${today}${sinceSuffix}.json`
    case "csv":
      return `rebar-export-${today}${sinceSuffix}.csv`
    case "logseq":
      return `rebar-logseq-export-${today}${sinceSuffix}.md`
    case "markdown":
    default:
      return `rebar-export-${today}${sinceSuffix}.md`
  }
}

export function getExportContentType(format: ExportFormat) {
  switch (format) {
    case "json":
      return "application/json; charset=utf-8"
    case "csv":
      return "text/csv; charset=utf-8"
    case "markdown":
    case "obsidian":
    case "logseq":
    default:
      return "text/markdown; charset=utf-8"
  }
}
