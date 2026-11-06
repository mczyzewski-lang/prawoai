import type { ReactNode } from 'react'
import type { Contract, Finding } from '../../types'
import { cx } from '../../lib/utils'
import { PRIORITY_META, priorityOf } from './Cards'

export type FindingFilter = 'otwarte' | 'najważniejsze' | 'kosmetyka' | 'rozpatrzone'

export interface NumberedFinding {
  f: Finding
  n: number
  /** Pozycja cytatu w treści zapisu (-1 = nie odnaleziono / brakujące postanowienie). */
  at: number
}

/** Numeruje uwagi w kolejności występowania w dokumencie (jak komentarze w edytorze). */
export function numberFindings(c: Contract): NumberedFinding[] {
  if (!c.analysis) return []
  const order = new Map(c.clauses.map((cl, i) => [cl.id, i]))
  const items = c.analysis.findings.map((f) => {
    const cl = f.clauseId ? c.clauses.find((x) => x.id === f.clauseId) : undefined
    const at = cl && f.excerpt ? cl.text.indexOf(f.excerpt) : -1
    return { f, at, ci: f.clauseId ? (order.get(f.clauseId) ?? 9999) : 10000 }
  })
  items.sort((a, b) => a.ci - b.ci || a.at - b.at)
  return items.map((x, i) => ({ f: x.f, n: i + 1, at: x.at }))
}

export function matchesFilter(f: Finding, filter: FindingFilter): boolean {
  if (filter === 'rozpatrzone') return f.status !== 'pending'
  if (f.status !== 'pending') return false
  if (filter === 'otwarte') return true
  return priorityOf(f) === filter
}

/**
 * Tekst zapisu z zakreślonymi fragmentami, których dotyczą komentarze.
 * Kliknięcie zakreślenia aktywuje komentarz na marginesie (i odwrotnie).
 */
export function HighlightedText({ text, marks, activeId, onActivate }: { text: string; marks: NumberedFinding[]; activeId: string | null; onActivate: (id: string) => void }) {
  const ranges = marks
    .filter((m) => m.at >= 0 && m.f.excerpt)
    .map((m) => ({ m, start: m.at, end: m.at + m.f.excerpt!.length }))
    .sort((a, b) => a.start - b.start)
  const parts: ReactNode[] = []
  let pos = 0
  for (const r of ranges) {
    if (r.start < pos) continue // nakładające się fragmenty – pierwszy wygrywa
    if (r.start > pos) parts.push(text.slice(pos, r.start))
    const pr = PRIORITY_META[priorityOf(r.m.f)]
    const active = activeId === r.m.f.id
    parts.push(
      <mark
        key={r.m.f.id}
        id={`fm-${r.m.f.id}`}
        role="button"
        tabIndex={0}
        aria-label={`Komentarz ${r.m.n}: ${r.m.f.title}`}
        aria-pressed={active}
        onClick={(e) => {
          e.stopPropagation()
          onActivate(r.m.f.id)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onActivate(r.m.f.id)
          }
        }}
        className={cx('cursor-pointer scroll-mt-32 rounded-[3px] px-0.5 text-inherit underline decoration-2 underline-offset-4 transition-colors', active ? pr.markActive : pr.mark)}
      >
        {text.slice(r.start, r.end)}
        <sup className={cx('ml-0.5 inline-grid h-4 min-w-4 place-items-center rounded-full px-1 align-super font-sans text-[10px] font-bold no-underline', pr.num)} aria-hidden>
          {r.m.n}
        </sup>
      </mark>,
    )
    pos = r.end
  }
  if (pos < text.length) parts.push(text.slice(pos))
  return <>{parts}</>
}
