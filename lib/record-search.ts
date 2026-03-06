const TEXT_SEARCH_OPTIONS = {
  type: "plain",
  config: "simple"
} as const

type SearchQueryBuilder<T> = {
  textSearch(column: string, query: string, options: typeof TEXT_SEARCH_OPTIONS): T
  or(filters: string): T
}

export const MAX_RECORD_SEARCH_QUERY_LENGTH = 200

export function parseSearchQuery(raw: string | null | undefined): { value: string | null; error: string | null } {
  const value = raw?.trim() ?? ""

  if (!value) {
    return { value: null, error: null }
  }

  if (value.length > MAX_RECORD_SEARCH_QUERY_LENGTH) {
    return {
      value: null,
      error: `Search query must be ${MAX_RECORD_SEARCH_QUERY_LENGTH} characters or fewer`
    }
  }

  return { value, error: null }
}

export function applyRecordSearchFilter<T extends SearchQueryBuilder<T>>(query: T, searchQuery: string, useTextSearch: boolean): T {
  if (useTextSearch) {
    return query.textSearch("fts", searchQuery, TEXT_SEARCH_OPTIONS)
  }

  const escaped = searchQuery.replace(/[\\%_]/g, "\\$&").replace(/[,]/g, "")
  return query.or(`content.ilike.%${escaped}%,source_title.ilike.%${escaped}%,current_note.ilike.%${escaped}%`)
}

export function isTextSearchUnavailable(error: { message?: string } | null | undefined): boolean {
  return /fts|textSearch|column/i.test(error?.message ?? "")
}
