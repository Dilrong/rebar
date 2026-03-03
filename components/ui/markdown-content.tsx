"use client"

import ReactMarkdown from "react-markdown"

type Props = {
    content: string
    className?: string
}

/**
 * Renders content as Markdown if it contains Markdown syntax,
 * otherwise falls back to plain text display.
 * Uses the @tailwindcss/typography `prose` class for readable formatting.
 */
export function MarkdownContent({ content, className = "" }: Props) {
    // Heuristic: if content has Markdown syntax, render it; else plain text
    const hasMarkdown = /^#{1,6}\s|^\*\s|\*\*|`|^\-\s|\[.+\]\(.+\)|^>\s|^---/m.test(content)

    if (!hasMarkdown) {
        return (
            <div className={`whitespace-pre-wrap ${className}`}>
                {content}
            </div>
        )
    }

    return (
        <div
            className={`
        prose prose-neutral dark:prose-invert max-w-none
        prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight
        prose-headings:border-b-2 prose-headings:border-foreground/20 prose-headings:pb-1
        prose-a:text-accent prose-a:font-bold prose-a:no-underline hover:prose-a:underline
        prose-strong:text-foreground prose-strong:font-black
        prose-code:font-mono prose-code:text-sm prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:border prose-code:border-border prose-code:rounded-none
        prose-pre:bg-muted prose-pre:border-4 prose-pre:border-foreground prose-pre:rounded-none prose-pre:shadow-brutal-sm
        prose-blockquote:border-l-4 prose-blockquote:border-accent prose-blockquote:bg-muted/30 prose-blockquote:not-italic
        prose-blockquote:text-foreground prose-blockquote:font-medium
        prose-img:border-4 prose-img:border-foreground prose-img:shadow-brutal-sm
        prose-hr:border-foreground prose-hr:border-2
        ${className}
      `}
        >
            <ReactMarkdown>{content}</ReactMarkdown>
        </div>
    )
}
