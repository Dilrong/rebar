import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export async function GET(request: Request) {
    const authHeader = request.headers.get("authorization") ?? ""
    let userId = null

    if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice("Bearer ".length).trim()
        if (token.length > 0) {
            const supabase = getSupabaseAdmin()
            const { data, error } = await supabase.auth.getUser(token)
            if (!error && data.user?.id) {
                userId = data.user.id
            }
        }
    }

    // Quick fallback check for development if no bearer token
    if (!userId && process.env.NODE_ENV === "development" && process.env.REBAR_DEV_USER_ID) {
        userId = process.env.REBAR_DEV_USER_ID
    }

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({
        key: process.env.REBAR_INGEST_API_KEY ?? ""
    })
}
