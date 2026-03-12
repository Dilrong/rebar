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

export function decodeSupabaseCookie(raw: string): { access_token?: string; refresh_token?: string; [key: string]: unknown } | null

export function getAuthSession(
  rebarUrl: string,
  cookiesApi?: { getAll(details: { domain: string }): Promise<Array<{ name: string; value: string; domain?: string }>> }
): Promise<{ access_token: string; refresh_token: string | null } | null>

export function getAccessToken(
  rebarUrl: string,
  cookiesApi?: { getAll(details: { domain: string }): Promise<Array<{ name: string; value: string; domain?: string }>> }
): Promise<string | null>

export function refreshAccessToken(
  rebarUrl: string,
  cookiesApi?: { getAll(details: { domain: string }): Promise<Array<{ name: string; value: string; domain?: string }>> }
): Promise<string | null>

export function authHeaders(token: string | null): { Authorization?: string }

export function shouldSkipTagPicker(mode: string): boolean

export function hostPermissionOrigin(urlStr: string): string

export function ensureHostPermission(
  urlStr: string,
  permissionsApi?: {
    request(details: { origins: string[] }): Promise<boolean>
    contains?(details: { origins: string[] }): Promise<boolean>
  }
): Promise<boolean>
