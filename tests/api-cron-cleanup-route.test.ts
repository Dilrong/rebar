import { beforeEach, describe, expect, it } from "vitest"
import { routePostCronCleanup as POST } from "./helpers/routes"

const PREV_ENV = { ...process.env }

describe("POST /api/cron/records/cleanup", () => {
  beforeEach(() => {
    process.env = { ...PREV_ENV }
    delete process.env.REBAR_CRON_SECRET
  })

  it("returns 401 when cron secret is missing", async () => {
    const response = await POST(new Request("http://localhost/api/cron/records/cleanup", { method: "POST" }))
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })
  })
})
