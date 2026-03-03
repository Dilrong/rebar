/**
 * Strips Markdown syntax from a string to produce plain text suitable
 * for card previews, list items, and meta descriptions.
 */
export function stripMarkdown(text: string): string {
    return text
        // code blocks
        .replace(/```[\s\S]*?```/g, "")
        // inline code
        .replace(/`[^`]*`/g, "")
        // headings (## Heading → Heading)
        .replace(/^#{1,6}\s+/gm, "")
        // images ![alt](url)
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
        // links [text](url)
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        // bold/italic ***text*** / **text** / *text* / ___text___ / __text__ / _text_
        .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
        .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
        // blockquote
        .replace(/^>\s+/gm, "")
        // horizontal rule
        .replace(/^[-*_]{3,}\s*$/gm, "")
        // list markers (- item / * item / 1. item)
        .replace(/^[\s]*[-*+]\s+/gm, "")
        .replace(/^[\s]*\d+\.\s+/gm, "")
        // extra blank lines
        .replace(/\n{2,}/g, " ")
        .replace(/\n/g, " ")
        .trim()
}
