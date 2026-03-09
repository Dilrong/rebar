import { describe, expect, it } from "vitest"
import { parseExternalItems } from "../app/(features)/capture/_lib/external-import"

describe("parseExternalItems", () => {
  it("maps readwise-style book highlights with note, anchor, and ids", () => {
    const items = parseExternalItems(
      JSON.stringify({
        results: [
          {
            id: "highlight-1",
            category: "books",
            highlight: "Important quote",
            note: "Why this matters",
            title: "Deep Work",
            author: "Cal Newport",
            book_id: "book-42",
            source_url: "https://example.com/deep-work",
            readwise_url: "https://readwise.io/open/highlight-1",
            location: "123",
            location_type: "page"
          }
        ]
      })
    )

    expect(items).toEqual([
      {
        content: "Important quote",
        note: "Why this matters",
        book_title: "Deep Work",
        book_author: "Cal Newport",
        url: "https://example.com/deep-work",
        source_url: "https://example.com/deep-work",
        anchor: "123 (page)",
        source_type: "book",
        source_service: "readwise",
        source_identity: "https://readwise.io/open/highlight-1",
        external_source_id: "book-42",
        external_item_id: "highlight-1"
      }
    ])
  })

  it("prefers source urls and article titles for readwise article payloads", () => {
    const items = parseExternalItems(
      JSON.stringify({
        highlights: [
          {
            text: "Article snippet",
            note: "follow up",
            article_title: "Article title",
            author: "Author Name",
            source_url: "https://example.com/articles/1",
            highlight_url: "https://readwise.io/highlights/1",
            location: "paragraph 4",
            category: "articles",
            tags: ["readwise", { name: "essay" }]
          }
        ]
      })
    )

    expect(items).toEqual([
      {
        content: "Article snippet",
        note: "follow up",
        source_title: "Article title",
        author: "Author Name",
        url: "https://example.com/articles/1",
        source_url: "https://example.com/articles/1",
        anchor: "paragraph 4",
        tags: ["readwise", "essay"],
        source_type: "article",
        source_service: "readwise"
      }
    ])
  })

  it("falls back to note-only records when readwise exports omit highlight text", () => {
    const items = parseExternalItems(
      JSON.stringify([
        {
          category: "books",
          note: "Standalone note",
          title: "Book with note only",
          author: "Author"
        }
      ])
    )

    expect(items).toEqual([
      {
        content: "Standalone note",
        book_title: "Book with note only",
        book_author: "Author",
        source_type: "book",
        source_service: "readwise"
      }
    ])
  })
})
