import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ArticleReader } from "../app/(features)/records/_components/article-reader"

describe("ArticleReader", () => {
  it("renders paragraphs and structured highlights as stable markup", () => {
    const html = renderToStaticMarkup(
      <ArticleReader
        content={"First paragraph text.\n\nSecond paragraph text."}
        highlights={[
          {
            id: "hl-1",
            anchor: JSON.stringify({
              v: 1,
              text: "paragraph",
              paragraphIndex: 0,
              startOffset: 6,
              endOffset: 15
            })
          }
        ]}
      />
    )

    expect(html).toContain("First ")
    expect(html).toContain("<mark")
    expect(html).toContain("data-rebar-hl=\"hl-1\"")
    expect(html).toContain("Second paragraph text.")
  })
})
