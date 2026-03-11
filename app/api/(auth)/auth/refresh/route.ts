import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const refreshToken = body?.refresh_token

    if (typeof refreshToken !== "string" || refreshToken.length === 0) {
      return NextResponse.json({ error: "missing refresh_token" }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })

    if (error || !data.session) {
      return NextResponse.json({ error: "refresh failed" }, { status: 401 })
    }

    return NextResponse.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    })
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 })
  }
}
