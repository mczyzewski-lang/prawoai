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

/** Stan AI: wynik pozytywny zapamiętujemy, negatywny sprawdzamy ponownie po 20 s (np. po włączeniu klucza). */
let statusOk = false
let statusAt = 0
export function getAiStatus(): Promise<AiStatus> {
  if (!statusCache || (!statusOk && Date.now() - statusAt > 20_000)) {
    statusAt = Date.now()
    statusCache = fetch('/api/status', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<AiStatus>) : { ai: false, model: null }))
      .catch(() => ({ ai: false, model: null }))
      .then((st) => {
        statusOk = !!st.ai
        return st
      })
  }
  return statusCache
}

interface RawFinding {
  clauseIndex: number
  insertAfterIndex: number
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
  verdict: string
  priorities: string[]
  checks: { title: string; detail: string; source: string }[]
  negotiationMessage: string
  contractType: string
  parties: { name: string; role: string; kind: 'osoba' | 'firma'; address: string; idNumber: string; representative: string }[]
  obligations: { party: string; items: string[] }[]
  dates: { label: string; value: string }[]
  payments: { label: string; value: string }[]
  findings: RawFinding[]
}

/** Usuwa wtrącone przez wyszukiwarkę odnośniki „([domena](url))”. */
function noCite(t: string): string {
  return (t ?? '').replace(/\s*\(\[[^\]]*\]\([^)]*\)\)/g, '').replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1').trim()
}

function cleanUrl(u: string): string | undefined {
  const m = (u ?? '').match(/https?:\/\/[^\s)\]]+/)
  return m ? m[0].replace(/[?&]utm_source=openai/, '') : undefined
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

/** Domyślne miejsce na nowy zapis: przed postanowieniami końcowymi. */
export function defaultInsertAfter(clauses: Clause[]): string | undefined {
  const finalIdx = clauses.findIndex((x) => /końcow/i.test(x.title))
  return (finalIdx > 0 ? clauses[finalIdx - 1] : clauses[clauses.length - 1])?.id
}

export interface AnalysisProgress {
  phase: 'reading' | 'writing' | 'verdict' | 'findings' | 'finishing'
  verdict?: string
  findings: { priority: string; title: string }[]
}

/** Odczyt strumienia SSE z /api/analyze; zwraca ostateczny wynik. */
async function readAnalysisStream(r: Response, onProgress: (p: AnalysisProgress) => void): Promise<{ result?: unknown; error?: string; code?: string; model?: string }> {
  const reader = r.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let sep
    while ((sep = buf.indexOf('\n\n')) !== -1) {
      const block = buf.slice(0, sep)
      buf = buf.slice(sep + 2)
      const event = block.match(/^event: (.+)$/m)?.[1]
      const data = block.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('')
      if (!event || !data) continue
      const payload = JSON.parse(data)
      if (event === 'progress') onProgress({ findings: [], ...payload })
      else if (event === 'result') return payload
      else if (event === 'error') return payload
    }
  }
  return { error: 'Połączenie z serwerem analizy zostało przerwane.', code: 'network' }
}

export async function analyzeWithAi(
  text: string,
  clauses: Clause[],
  sourceName: string,
  perspective?: Perspective,
  context?: string,
  persona?: { addressAs: string; form: string },
  onProgress?: (p: AnalysisProgress) => void,
): Promise<AnalysisResult> {
  let data: { result?: unknown; error?: string; code?: string; model?: string } | null
  try {
    const r = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(onProgress ? { Accept: 'text/event-stream' } : {}) },
      body: JSON.stringify({ clauses: clauses.map((c) => ({ title: c.title, text: c.text })), perspective, context, persona }),
    })
    if (onProgress && r.ok && r.headers.get('content-type')?.includes('text/event-stream')) data = await readAnalysisStream(r, onProgress)
    else {
      data = await r.json().catch(() => null)
      if (!r.ok && data && !data.error) data.error = 'Nie udało się przeprowadzić analizy.'
    }
  } catch {
    throw new AiAnalysisError('Brak połączenia z serwerem analizy.', 'network')
  }
  if (!data?.result) throw new AiAnalysisError(data?.error ?? 'Nie udało się przeprowadzić analizy.', data?.code ?? 'unknown')
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
      insertAfterClauseId: clause ? undefined : (clauses[f.insertAfterIndex]?.id ?? defaultInsertAfter(clauses)),
      severity: importance >= 4 ? 'high' : importance === 3 ? 'medium' : 'low',
      priority: f.priority,
      importance,
      aspect: f.aspect,
      impact: noCite(f.impact ?? '') || undefined,
      category: clause ? f.category : 'brak',
      title: noCite(f.title),
      explanation: noCite(f.explanation),
      suggestion: f.suggestion.trim(),
      excerpt,
      status: 'pending',
    })
  }
  findings.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'najważniejsze' ? -1 : 1) || (b.importance ?? 0) - (a.importance ?? 0))

  return {
    createdAt: nowIso(),
    summary: noCite(raw.summary),
    verdict: raw.verdict?.trim() || undefined,
    priorities: (raw.priorities ?? []).filter(Boolean).slice(0, 3),
    checks: (raw.checks ?? []).slice(0, 10).map((c) => ({ title: noCite(c.title), detail: noCite(c.detail), source: cleanUrl(c.source) })),
    negotiationMessage: raw.negotiationMessage?.trim() || undefined,
    context: context?.trim() || undefined,
    contractType: raw.contractType,
    parties: raw.parties.slice(0, 2).map((p) => ({ name: p.name, role: p.role, kind: p.kind, address: p.address?.trim() || undefined, idNumber: p.idNumber?.replace(/^\s*(NIP|PESEL|KRS)\s*[:.]?\s*/i, '').trim() || undefined, representative: p.representative?.trim() || undefined, details: p.address?.trim() || undefined })),
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
