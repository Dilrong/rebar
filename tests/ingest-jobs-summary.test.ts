import { describe, expect, it } from "vitest"
import { summarizeIngestJobPayload, toIngestJobListItem } from "@feature-lib/capture/ingest-jobs"

describe("summarizeIngestJobPayload", () => {
  it("derives item count, import channel, and preview from a valid payload", () => {
    expect(
      summarizeIngestJobPayload({
        import_channel: "csv",
        items: [{ book_title: "Deep Work", content: "Important quote" }, { content: "Second quote" }]
      })
    ).toEqual({
      item_count: 2,
      import_channel: "csv",
      preview: "Deep Work"
    })
  })

  it("falls back to unknown metadata for invalid payloads", () => {
    expect(summarizeIngestJobPayload({ bad: true })).toEqual({
      item_count: 0,
      import_channel: "unknown",
      preview: null
    })
  })
})

describe("toIngestJobListItem", () => {
  it("merges base job fields with derived payload metadata", () => {
    expect(
      toIngestJobListItem({
        id: "job-1",
        status: "FAILED",
        attempts: 2,
        last_error: "network",
        created_at: "2026-03-11T00:00:00.000Z",
        payload: {
          import_channel: "json",
          items: [{ source_title: "Article title", content: "Snippet" }]
        }
      })
    ).toEqual({
      id: "job-1",
      status: "FAILED",
      attempts: 2,
      last_error: "network",
      created_at: "2026-03-11T00:00:00.000Z",
      item_count: 1,
      import_channel: "json",
      preview: "Article title"
    })
  })
})
