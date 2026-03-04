export type RecordAssistInput = {
  content: string
  sourceTitle?: string | null
  annotations?: string[]
  tags?: string[]
}

export type RecordAssistOutput = {
  summary: string[]
  questions: string[]
  todos: string[]
  signals: {
    topKeywords: string[]
  }
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "on",
  "with",
  "is",
  "are",
  "was",
  "were",
  "be",
  "this",
  "that",
  "it",
  "as",
  "by",
  "from",
  "about",
  "into",
  "your",
  "our",
  "their",
  "have",
  "has",
  "had",
  "나",
  "너",
  "저",
  "그",
  "이",
  "및",
  "그리고",
  "또는",
  "에서",
  "으로",
  "하다",
  "하는",
  "했다",
  "합니다",
  "것",
  "수"
])

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function splitSentences(value: string): string[] {
  return value
    .split(/[.!?\n]/)
    .map((part) => normalizeText(part))
    .filter((part) => part.length >= 24)
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
}

function extractTopKeywords(value: string, max = 6): string[] {
  const counts = new Map<string, number>()
  for (const token of tokenize(value)) {
    counts.set(token, (counts.get(token) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([token]) => token)
}

function dedupe(items: string[], max: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    const key = item.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    out.push(item)
    if (out.length >= max) {
      break
    }
  }

  return out
}

function scoreSentence(sentence: string, keywords: string[]): number {
  const lower = sentence.toLowerCase()
  let score = 0

  for (const keyword of keywords) {
    if (lower.includes(keyword)) {
      score += 2
    }
  }

  if (sentence.length >= 60) {
    score += 1
  }

  return score
}

function hasHangul(text: string): boolean {
  return /[가-힣]/.test(text)
}

function extractActionCandidates(lines: string[]): string[] {
  const actionRegex = /(todo|to do|action|next|must|should|해야|할 일|실행|다음)/i
  return lines
    .map((line) => normalizeText(line))
    .filter((line) => line.length >= 8 && actionRegex.test(line))
    .map((line) =>
      line
        .replace(/^(todo|to do|action|next)\s*[:\-]?\s*/i, "")
        .replace(/^(해야 할 일|할 일|실행)\s*[:\-]?\s*/i, "")
        .trim()
    )
    .filter((line) => line.length >= 6)
}

export function generateRecordAssist(input: RecordAssistInput): RecordAssistOutput {
  const body = normalizeText(input.content)
  const sentences = splitSentences(body)
  const keywords = extractTopKeywords([body, ...(input.annotations ?? []), ...(input.tags ?? [])].join(" "))

  const summaryCandidates =
    sentences.length > 0
      ? sentences
          .map((sentence) => ({ sentence, score: scoreSentence(sentence, keywords) }))
          .sort((a, b) => b.score - a.score)
          .map((entry) => entry.sentence)
      : [body]

  const summary = dedupe(summaryCandidates, 3).map((item) => item.slice(0, 180))

  const korean = hasHangul(body)
  const selectedKeywords = keywords.slice(0, 3)
  const keywordFallback = selectedKeywords.length > 0 ? selectedKeywords : [korean ? "핵심 아이디어" : "core idea"]

  const questions = dedupe(
    keywordFallback.flatMap((keyword) =>
      korean
        ? [
            `${keyword}를 지금 진행 중인 프로젝트에 적용하려면 어떤 첫 실험이 필요한가?`,
            `${keyword}와 충돌하는 기존 가정은 무엇이며 어떤 데이터로 검증할 수 있는가?`
          ]
        : [
            `What is the smallest experiment to apply ${keyword} this week?`,
            `Which current assumption conflicts with ${keyword}, and how can it be validated?`
          ]
    ),
    3
  )

  const actionCandidates = extractActionCandidates([...(input.annotations ?? []), ...body.split(/\n+/)])
  const generatedTodos =
    actionCandidates.length > 0
      ? actionCandidates
      : keywordFallback.map((keyword, index) =>
          korean
            ? index === 0
              ? `${keyword} 관련 실행 항목 1개를 오늘 안에 정의한다.`
              : `${keyword}를 검증할 15분 실험을 캘린더에 등록한다.`
            : index === 0
              ? `Define one concrete action for ${keyword} before end of day.`
              : `Schedule a 15-minute experiment to validate ${keyword}.`
        )

  return {
    summary,
    questions,
    todos: dedupe(generatedTodos, 4),
    signals: {
      topKeywords: keywords.slice(0, 6)
    }
  }
}
