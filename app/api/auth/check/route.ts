import { NextResponse } from "next/server"
import { getUserId } from "@/lib/auth"

export async function GET(request: Request) {
  const userId = await getUserId(request.headers)

  if (!userId) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  return NextResponse.json({ authenticated: true })
}
