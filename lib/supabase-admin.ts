import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

let cachedAdminClient: SupabaseClient<Database> | null = null
let cachedAdminSignature: string | null = null

export function getSupabaseAdmin(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL")
  }

  if (!key) {
    throw new Error("Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY")
  }

  if (key.startsWith("YOUR_")) {
    throw new Error("Supabase key is a placeholder value")
  }

  const signature = `${url}::${key}`
  if (cachedAdminClient && cachedAdminSignature === signature) {
    return cachedAdminClient
  }

  cachedAdminClient = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  cachedAdminSignature = signature

  return cachedAdminClient
}
