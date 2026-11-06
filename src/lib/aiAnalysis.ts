import type { AnalysisResult, Clause, Finding, FindingAspect, FindingPriority } from '../types'
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
  priority: FindingPriority
  importance: number
  aspect: FindingAspect
  category: Finding['category']
  title: string
  explanation: string
  impact: string
  excerpt: string
  suggestion: string
}

interface RawResult {
  summary: string
  contractType: string
  parties: { name: string; role: string; details: string }[]
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

export interface Perspective {
  role: string
  name: string
  otherRole: string
}

export async function analyzeWithAi(text: string, clauses: Clause[], sourceName: string, perspective?: Perspective): Promise<AnalysisResult> {
  let r: Response
  try {
    r = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clauses: clauses.map((c) => ({ title: c.title, text: c.text })), perspective }),
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
    const importance = Math.min(5, Math.max(1, Math.round(f.importance) || 3))
    findings.push({
      id: uid('f'),
      clauseId: clause?.id ?? null,
      severity: importance >= 4 ? 'high' : importance === 3 ? 'medium' : 'low',
      priority: f.priority,
      importance,
      aspect: f.aspect,
      impact: f.impact?.trim() || undefined,
      category: clause ? f.category : 'brak',
      title: f.title,
      explanation: f.explanation,
      suggestion: f.suggestion.trim(),
      excerpt,
      status: 'pending',
    })
  }
  findings.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'najważniejsze' ? -1 : 1) || (b.importance ?? 0) - (a.importance ?? 0))

  return {
    createdAt: nowIso(),
    summary: raw.summary,
    contractType: raw.contractType,
    parties: raw.parties.slice(0, 2).map((p) => ({ name: p.name, role: p.role, details: p.details?.trim() || undefined })),
    obligations: raw.obligations,
    dates: raw.dates,
    payments: raw.payments,
    findings,
    sourceName,
    wordCount: wordCount(text),
    engine: 'ai',
    model: data.model,
    perspective: perspective ? { role: perspective.role, name: perspective.name } : undefined,
  }
}
