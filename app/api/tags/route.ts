import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { PG_UNIQUE_VIOLATION } from "@/lib/constants"
import { fail, ok } from "@/lib/http"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const CreateTagSchema = z.object({
  name: z.string().min(1).max(50)
})

export async function GET(request: NextRequest) {
  const userId = await getUserId(request.headers)
  if (!userId) {
    return fail("Unauthorized", 401)
  }

  const supabase = getSupabaseAdmin()
  const result = await supabase
    .from("tags")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true })

  if (result.error) {
    return fail(result.error.message, 500)
  }

  return ok({ data: result.data })
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request.headers)
  if (!userId) {
    return fail("Unauthorized", 401)
  }

  const body = await request.json().catch(() => null)
  const parsed = CreateTagSchema.safeParse(body)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 400)
  }

  const normalized = parsed.data.name.trim()
  if (!normalized) {
    return fail("Tag name is required", 400)
  }

  const supabase = getSupabaseAdmin()
  const created = await supabase
    .from("tags")
    .insert({ user_id: userId, name: normalized })
    .select("*")
    .single()

  if (created.error) {
    if (created.error.code === PG_UNIQUE_VIOLATION) {
      return fail("Tag already exists", 409)
    }

    return fail(created.error.message, 500)
  }

  return ok({ tag: created.data }, { status: 201 })
}
