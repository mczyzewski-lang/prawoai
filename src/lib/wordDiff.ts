/** Kluczowe wartości w zapisie: kwoty, procenty, terminy („w ciągu 48 h”, „14 dni”), okresy. */
const KEY_TERMS =
  /(?:w ciągu|w terminie|nie później niż|do|po|przez|najpóźniej)?\s*\d+(?:[.,]\d+)?\s*(?:%|proc\.?|zł|PLN|h\b|godz\p{L}*|dni\p{L}*|dzie\p{L}*|tygod\p{L}*|miesi\p{L}*|lat\p{L}*|rok\p{L}*)(?:\s+(?:roboczych|kalendarzowych|brutto|netto))?/giu

export interface TextPart {
  text: string
  strong: boolean
}

const norm = (w: string) => w.toLowerCase().replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, '')

/**
 * Części nowego brzmienia z wyróżnieniem tego, co istotnie się zmienia względem starego
 * (słowa dodane lub zmienione). Gdy zapis jest napisany od nowa – wyróżnia kluczowe wartości.
 */
export function highlightChanges(before: string | undefined, after: string): TextPart[] {
  const tokens = after.split(/(\s+)/)
  const words = tokens.map((t, i) => ({ t, i })).filter((x) => x.t.trim())
  if (!before?.trim()) return keyTerms(after)
  const a = before.split(/\s+/).filter(Boolean).map(norm)
  const b = words.map((w) => norm(w.t))
  // LCS na słowach
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const kept = new Set<number>()
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      kept.add(j)
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  const changed = words.filter((_, k) => !kept.has(k) && b[k])
  if (!changed.length) return [{ text: after, strong: false }]
  // Prawie wszystko nowe – pogrubianie całości nic nie mówi; wyróżniamy kluczowe wartości.
  if (changed.length / Math.max(1, words.length) > 0.6) return keyTerms(after)
  const strongTok = new Set(words.filter((_, k) => !kept.has(k) && b[k]).map((w) => w.i))
  const parts: TextPart[] = []
  tokens.forEach((t, idx) => {
    // spacja między dwoma wyróżnionymi słowami też jest wyróżniona (jeden blok)
    const strong = strongTok.has(idx) || (!t.trim() && strongTok.has(idx - 1) && strongTok.has(idx + 1))
    const last = parts[parts.length - 1]
    if (last && last.strong === strong) last.text += t
    else parts.push({ text: t, strong })
  })
  return parts
}

function keyTerms(text: string): TextPart[] {
  const parts: TextPart[] = []
  let pos = 0
  for (const m of text.matchAll(KEY_TERMS)) {
    const raw = m[0]
    const lead = raw.length - raw.trimStart().length
    const start = (m.index ?? 0) + lead
    if (start > pos) parts.push({ text: text.slice(pos, start), strong: false })
    parts.push({ text: raw.trim(), strong: true })
    pos = start + raw.trim().length
  }
  if (pos < text.length) parts.push({ text: text.slice(pos), strong: false })
  return parts.length ? parts : [{ text, strong: false }]
}
