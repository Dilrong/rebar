import { NextRequest } from "next/server"
import { getUserId } from "@/lib/auth"
import { fail, ok } from "@/lib/http"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export async function GET(request: NextRequest) {
  const userId = await getUserId(request.headers)
  if (!userId) {
    return fail("Unauthorized", 401)
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  if (!q) {
    return fail("q is required", 400)
  }

  const escaped = q.replace(/[,%]/g, "")
  const supabase = getSupabaseAdmin()
  const result = await supabase
    .from("records")
    .select("*")
    .eq("user_id", userId)
    .neq("state", "TRASHED")
    .or(`content.ilike.%${escaped}%,source_title.ilike.%${escaped}%`)
    .order("created_at", { ascending: false })

  if (result.error) {
    return fail(result.error.message, 500)
  }

  return ok({ data: result.data })
}
