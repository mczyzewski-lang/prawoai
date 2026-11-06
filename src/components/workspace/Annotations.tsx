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
    const anchor = f.clauseId ?? f.insertAfterClauseId
    const ci = anchor ? (order.get(anchor) ?? 9999) + (f.clauseId ? 0 : 0.5) : 10000
    return { f, at, sortAt: f.clauseId ? at : 1e9, ci }
  })
  items.sort((a, b) => a.ci - b.ci || a.sortAt - b.sortAt)
  return items.map((x, i) => ({ f: x.f, n: i + 1, at: x.at }))
}

export function matchesFilter(f: Finding, filter: FindingFilter): boolean {
  if (filter === 'rozpatrzone') return f.status !== 'pending'
  if (f.status !== 'pending') return false
  if (filter === 'otwarte') return true
  return priorityOf(f) === filter
}

/** Fragment zakreślenia w obrębie jednej linii (cytat może obejmować kilka linii). */
export interface MarkSegment {
  m: NumberedFinding
  start: number
  end: number
  /** Pierwszy fragment cytatu – kotwica do przewijania. */
  first: boolean
  /** Ostatni fragment – tu stoi numer komentarza. */
  last: boolean
}

/** Dzieli zakreślenia na fragmenty w zakresie [from, to) tekstu zapisu (przesunięte do 0). `first` ustawia wywołujący. */
export function segmentsFor(marks: NumberedFinding[], from: number, to: number): MarkSegment[] {
  const out: MarkSegment[] = []
  for (const m of marks) {
    if (m.at < 0 || !m.f.excerpt) continue
    const a = m.at
    const b = m.at + m.f.excerpt.length
    const s = Math.max(a, from)
    const e = Math.min(b, to)
    if (s < e) out.push({ m, start: s - from, end: e - from, first: false, last: e === b })
  }
  return out.sort((x, y) => x.start - y.start)
}

/**
 * Tekst zapisu z zakreślonymi fragmentami, których dotyczą komentarze.
 * Kliknięcie zakreślenia aktywuje komentarz na marginesie (i odwrotnie).
 * `hoverId` – komentarz wskazany myszą na marginesie (wyraźniejsze wyróżnienie).
 */
export function HighlightedText({ text, segments, activeId, hoverId, onActivate }: { text: string; segments: MarkSegment[]; activeId: string | null; hoverId?: string | null; onActivate: (id: string) => void }) {
  const ranges = [...segments].sort((a, b) => a.start - b.start)
  const parts: ReactNode[] = []
  let pos = 0
  for (const r of ranges) {
    if (r.start < pos) continue // nakładające się fragmenty – pierwszy wygrywa
    if (r.start > pos) parts.push(text.slice(pos, r.start))
    const pr = PRIORITY_META[priorityOf(r.m.f)]
    const active = activeId === r.m.f.id
    const hovered = hoverId === r.m.f.id
    parts.push(
      <mark
        key={`${r.m.f.id}-${r.start}`}
        id={r.first ? `fm-${r.m.f.id}` : undefined}
        role="button"
        tabIndex={r.first ? 0 : -1}
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
        className={cx(
          'cursor-pointer scroll-mt-32 rounded-[3px] px-0.5 text-inherit underline decoration-2 underline-offset-4 transition-[background-color,box-shadow,color]',
          active || hovered ? pr.markActive : pr.mark,
          active && 'animate-mark-breathe',
          hovered && !active && 'text-ink-950 shadow-[0_0_0_2px_rgba(15,23,42,0.18)]',
        )}
      >
        {text.slice(r.start, r.end)}
        {r.last && (
          <sup className={cx('ml-0.5 inline-grid h-4 min-w-4 place-items-center rounded-full px-1 align-super font-sans text-[10px] font-bold no-underline', pr.num, active && 'animate-num-pulse')} aria-hidden>
            {r.m.n}
          </sup>
        )}
      </mark>,
    )
    pos = r.end
  }
  if (pos < text.length) parts.push(text.slice(pos))
  return <>{parts}</>
}
