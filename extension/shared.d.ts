export const DEFAULT_SETTINGS: {
  rebarUrl: string
  defaultTags: string
}

export const CONTENT_LIMIT: number

export const MSG: {
  GET_SELECTION: string
  GET_ARTICLE: string
  SHOW_BANNER: string
  HIDE_BANNER: string
  PICK_TAGS: string
  CANCEL_SAVE: string
  SAVE_CAPTURE: string
  GET_SETTINGS: string
}

export function normalizeTagList(tags: unknown[] | null | undefined): string[]

export function parseTags(tagText: string | null | undefined): string[]

export function isValidUrl(value: string): boolean

export function normalizeUrl(value: string | null | undefined): string

export function errorMessage(error: unknown): string
