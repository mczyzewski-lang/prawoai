import type { AnalysisResult, Clause, Finding } from '../types'
import { nowIso, uid, wordCount } from './utils'

/**
 * Analiza umowy przez model AI (OpenAI) – wywoływana przez serwer /api/analyze,
 * aby klucz API nigdy nie trafiał do przeglądarki.
 */

export interface AiStatus {
  ai: boolean
  model: string | null
}

export class AiAnalysisError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

let statusCache: Promise<AiStatus> | null = null

export function getAiStatus(): Promise<AiStatus> {
  statusCache ??= fetch('/api/status')
    .then((r) => (r.ok ? (r.json() as Promise<AiStatus>) : { ai: false, model: null }))
    .catch(() => ({ ai: false, model: null }))
  return statusCache
}

interface RawFinding {
  clauseIndex: number
  severity: Finding['severity']
  category: Finding['category']
  title: string
  explanation: string
  excerpt: string
  suggestion: string
}

interface RawResult {
  summary: string
  contractType: string
  parties: { name: string; role: string }[]
  obligations: { party: string; items: string[] }[]
  dates: { label: string; value: string }[]
  payments: { label: string; value: string }[]
  findings: RawFinding[]
}

/** Odnajduje cytat w treści zapisu (tolerancja na różnice w białych znakach i cudzysłowach). */
function locate(haystack: string, quote: string): string | undefined {
  const q = quote.trim().replace(/^[„"“]+|[”"“]+$/g, '').replace(/\.{3}|…/g, '').trim()
  if (!q) return undefined
  if (haystack.includes(q)) return q
  const esc = q
    .split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/["„”“]/g, '["„”“]'))
    .join('\\s+')
  const m = haystack.match(new RegExp(esc))
  return m?.[0]
}

export async function analyzeWithAi(text: string, clauses: Clause[], sourceName: string): Promise<AnalysisResult> {
  let r: Response
  try {
    r = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clauses: clauses.map((c) => ({ title: c.title, text: c.text })) }),
    })
  } catch {
    throw new AiAnalysisError('Brak połączenia z serwerem analizy.', 'network')
  }
  const data = await r.json().catch(() => null)
  if (!r.ok || !data?.result) throw new AiAnalysisError(data?.error ?? 'Nie udało się przeprowadzić analizy.', data?.code ?? 'unknown')
  const raw = data.result as RawResult

  const findings: Finding[] = []
  for (const f of raw.findings ?? []) {
    const clause = f.clauseIndex >= 0 ? clauses[f.clauseIndex] : undefined
    if (f.clauseIndex >= 0 && !clause) continue
    const excerpt = clause ? locate(clause.text, f.excerpt) : f.excerpt.trim() || f.title
    findings.push({
      id: uid('f'),
      clauseId: clause?.id ?? null,
      severity: f.severity,
      category: clause ? f.category : 'brak',
      title: f.title,
      explanation: f.explanation,
      suggestion: f.suggestion.trim(),
      excerpt,
      status: 'pending',
    })
  }
  const rank = { high: 0, medium: 1, low: 2 }
  findings.sort((a, b) => rank[a.severity] - rank[b.severity])

  return {
    createdAt: nowIso(),
    summary: raw.summary,
    contractType: raw.contractType,
    parties: raw.parties.slice(0, 2),
    obligations: raw.obligations,
    dates: raw.dates,
    payments: raw.payments,
    findings,
    sourceName,
    wordCount: wordCount(text),
    engine: 'ai',
    model: data.model,
  }
}
