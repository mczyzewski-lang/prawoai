import { useState } from 'react'
import { AlertOctagon, AlertTriangle, Check, ChevronUp, CircleHelp, FilePlus2, Info, Lock, Pencil, RotateCcw, Undo2, X } from 'lucide-react'
import { highlightChanges } from '../../lib/wordDiff'
import type { Clause, Finding, FindingAspect, FindingPriority, PartyId, Proposal } from '../../types'
import { cx, formatRelative } from '../../lib/utils'
import { Avatar, Badge, Button } from '../ui'
import { Diff } from './Diff'

export const SEVERITY_META = {
  high: { label: 'Wysokie ryzyko', tone: 'red' as const, Icon: AlertOctagon, bar: 'bg-red-500' },
  medium: { label: 'Do sprawdzenia', tone: 'amber' as const, Icon: AlertTriangle, bar: 'bg-amber-500' },
  low: { label: 'Wskazówka', tone: 'sky' as const, Icon: Info, bar: 'bg-sky-500' },
}

export const PRIORITY_META = {
  najważniejsze: { label: 'Najważniejsze', badge: 'bg-rose-50 text-rose-800 ring-rose-200', mark: 'bg-rose-100/80 decoration-rose-400', markActive: 'bg-rose-200 decoration-rose-600', bar: 'bg-rose-500', num: 'bg-rose-600 text-white' },
  kosmetyka: { label: 'Kosmetyka', badge: 'bg-sky-50 text-sky-800 ring-sky-200', mark: 'bg-sky-100/70 decoration-sky-400', markActive: 'bg-sky-200 decoration-sky-600', bar: 'bg-sky-400', num: 'bg-sky-600 text-white' },
}

const ASPECT_LABEL: Record<FindingAspect, string> = { prawne: 'Prawne', finansowe: 'Finansowe', biznesowe: 'Biznesowe', operacyjne: 'Operacyjne' }

export function priorityOf(f: Finding): FindingPriority {
  return f.priority ?? (f.severity === 'low' ? 'kosmetyka' : 'najważniejsze')
}

export function importanceOf(f: Finding): number {
  return f.importance ?? (f.severity === 'high' ? 5 : f.severity === 'medium' ? 3 : 2)
}

export function ImportanceMeter({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-600" title={`Istotność ${value} z 5`}>
      <span className="sr-only">Istotność {value} z 5</span>
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={cx('h-2.5 w-1.5 rounded-sm', i <= value ? (value >= 4 ? 'bg-rose-500' : value === 3 ? 'bg-amber-500' : 'bg-sky-500') : 'bg-slate-200')} />
        ))}
      </span>
      <span aria-hidden>{value}/5</span>
    </span>
  )
}

export function FindingCard({
  f,
  number,
  clause,
  onDecide,
  onSelectClause,
  shared,
  collapsible,
  active,
  onActivate,
  onHover,
  anchored = true,
}: {
  f: Finding
  number?: number
  clause?: Clause
  onDecide: (decision: 'accept' | 'reject' | 'edit' | 'reset', text?: string) => void
  onSelectClause?: () => void
  shared: boolean
  /** Tryb marginesu: zwinięta karta rozwija się po aktywacji. */
  collapsible?: boolean
  active?: boolean
  onActivate?: () => void
  /** Najechanie myszą – wyróżnienie fragmentu w umowie. */
  onHover?: (hovered: boolean) => void
  /** Czy cytat został odnaleziony w tekście (zakreślenie). */
  anchored?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(f.editedText ?? f.suggestion)
  const pr = PRIORITY_META[priorityOf(f)]
  const done = f.status !== 'pending'
  const expanded = !collapsible || active || editing
  return (
    <article
      id={`fc-${f.id}`}
      className={cx('relative scroll-mt-28 overflow-hidden rounded-2xl bg-white ring-1 transition', active ? 'shadow-lg ring-2 ring-ink-800' : 'ring-slate-200', done && !active && 'opacity-75', collapsible && 'cursor-pointer', collapsible && !active && 'hover:ring-slate-300')}
      aria-label={`Komentarz ${number ?? ''}: ${f.title}`}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
      onClick={
        collapsible
          ? (e) => {
              // Klik w dowolne miejsce karty rozwija/zwija – poza przyciskami, polami i zaznaczonym tekstem.
              if ((e.target as HTMLElement).closest('button, a, textarea, input, select, label')) return
              if (window.getSelection()?.toString()) return
              if (editing) return
              onActivate?.()
            }
          : undefined
      }
    >
      <span className={cx('absolute inset-y-0 left-0 w-1', pr.bar)} aria-hidden />
      <div className="p-3.5 pl-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {number !== undefined && <span className={cx('grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold', pr.num)}>{number}</span>}
          <span className={cx('rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset', pr.badge)}>{pr.label}</span>
          {f.aspect && <Badge tone="slate">{ASPECT_LABEL[f.aspect]}</Badge>}
          <span className="ml-auto">
            <ImportanceMeter value={importanceOf(f)} />
          </span>
          {collapsible && active && !editing && (
            <button
              type="button"
              onClick={onActivate}
              className="-mr-1 grid size-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-ink-900"
              aria-label="Zwiń komentarz"
              title="Zwiń"
            >
              <ChevronUp className="size-4" aria-hidden />
            </button>
          )}
        </div>
        {collapsible && !active ? (
          <button type="button" onClick={onActivate} aria-expanded={false} className="mt-1.5 block w-full text-left">
            <span className="block text-sm font-semibold leading-snug text-ink-900">{f.title}</span>
            <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-slate-600">{f.impact ?? f.explanation}</span>
            {done && <span className="mt-1 block text-[11px] font-medium text-slate-500">{f.status === 'rejected' ? 'Odrzucono' : 'Wprowadzono'}</span>}
          </button>
        ) : (
          <h4 className="mt-1.5 font-semibold leading-snug text-ink-900">{f.title}</h4>
        )}
        {expanded && (
          <>
            {clause && onSelectClause && (
              <button type="button" onClick={onSelectClause} className="mt-1 text-xs font-medium text-brand-700 hover:underline">
                Pokaż w tekście: {clause.title}
              </button>
            )}
            {f.excerpt && f.clauseId && (
              <blockquote className="mt-2 border-l-2 border-slate-300 pl-3 font-serif text-[13.5px] italic leading-relaxed text-slate-600">„{f.excerpt}”</blockquote>
            )}
            {f.clauseId && !anchored && <p className="mt-1 text-[11px] text-slate-500">Dotyczy całego zapisu.</p>}
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{f.explanation}</p>
            {f.impact && (
              <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-950">
                <span className="font-semibold">Co to oznacza dla Ciebie: </span>
                {f.impact}
              </div>
            )}

            <div className="mt-3 rounded-xl bg-brand-50/70 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-800">{f.clauseId ? 'Proponowane brzmienie' : `Proponowany nowy zapis: ${f.excerpt ?? ''}`}</p>
              {editing ? (
                <>
                  <label htmlFor={`edit-${f.id}`} className="sr-only">
                    Edytuj proponowane brzmienie
                  </label>
                  <textarea id={`edit-${f.id}`} value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} className="w-full rounded-lg border border-brand-200 bg-white p-2.5 font-serif text-[14px] leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
                </>
              ) : (
                <p className="whitespace-pre-line font-serif text-[14px] leading-relaxed text-ink-900">
                  {highlightChanges(f.clauseId ? f.excerpt : undefined, (f.status === 'edited' ? f.editedText : f.suggestion) ?? '').map((p, i) =>
                    p.strong ? (
                      <strong key={i} className="font-semibold text-ink-950 [background:linear-gradient(transparent_62%,rgba(47,184,165,0.28)_62%)]">
                        {p.text}
                      </strong>
                    ) : (
                      <span key={i}>{p.text}</span>
                    ),
                  )}
                </p>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {f.status === 'pending' && !editing && (
                <>
                  <Button size="sm" variant="accent" icon={<Check className="size-3.5" />} onClick={() => onDecide('accept')}>
                    {shared ? 'Zaproponuj stronie' : 'Akceptuj'}
                  </Button>
                  <Button size="sm" variant="secondary" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(true)}>
                    Edytuj
                  </Button>
                  <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} onClick={() => onDecide('reject')}>
                    Odrzuć
                  </Button>
                </>
              )}
              {editing && (
                <>
                  <Button
                    size="sm"
                    variant="accent"
                    icon={<Check className="size-3.5" />}
                    disabled={!draft.trim()}
                    onClick={() => {
                      onDecide('edit', draft.trim())
                      setEditing(false)
                    }}
                  >
                    {shared ? 'Zaproponuj moją wersję' : 'Zapisz i wprowadź'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                    Anuluj
                  </Button>
                </>
              )}
              {f.status === 'accepted' && <Badge tone="brand"><Check className="size-3" aria-hidden /> {shared ? 'Wysłano jako propozycję' : 'Wprowadzono'}</Badge>}
              {f.status === 'edited' && <Badge tone="brand"><Pencil className="size-3" aria-hidden /> {shared ? 'Wysłano Twoją wersję' : 'Wprowadzono Twoją wersję'}</Badge>}
              {f.status === 'rejected' && (
                <>
                  <Badge tone="slate"><X className="size-3" aria-hidden /> Odrzucono</Badge>
                  <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => onDecide('reset')}>
                    Przywróć
                  </Button>
                </>
              )}
              {f.clauseId === null && f.status === 'pending' && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <FilePlus2 className="size-3.5" aria-hidden /> doda nowy zapis
                </span>
              )}
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-500" title="Widoczne tylko dla Ciebie">
                <Lock className="size-3" aria-hidden /> prywatne
              </span>
            </div>
          </>
        )}
      </div>
    </article>
  )
}

const PROPOSAL_STATUS = {
  open: { label: 'Oczekuje', tone: 'amber' as const },
  accepted: { label: 'Zaakceptowana', tone: 'brand' as const },
  rejected: { label: 'Odrzucona', tone: 'red' as const },
  withdrawn: { label: 'Wycofana', tone: 'slate' as const },
}

export function ProposalCard({
  p,
  clause,
  viewer,
  canAct,
  onResolve,
  onSelectClause,
  onCounter,
}: {
  p: Proposal
  clause?: Clause
  viewer: PartyId
  canAct: boolean
  onResolve: (d: 'accepted' | 'rejected' | 'withdrawn') => void
  onSelectClause?: () => void
  onCounter?: () => void
}) {
  const mine = p.authorPartyId === viewer
  const st = PROPOSAL_STATUS[p.status]
  return (
    <article className="rounded-2xl bg-white p-4 ring-1 ring-slate-200" aria-label={`Propozycja zmiany od ${p.authorName}`}>
      <div className="flex items-start gap-2.5">
        <Avatar name={p.authorName} tone={mine ? 'brand' : 'violet'} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-semibold text-ink-900">{mine ? 'Ty' : p.authorName}</span> <span className="text-slate-600">proponuje zmianę</span>
          </p>
          <p className="text-xs text-slate-500">{formatRelative(p.createdAt)}</p>
        </div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      {clause && onSelectClause && (
        <button type="button" onClick={onSelectClause} className="mt-2 text-xs font-medium text-brand-700 hover:underline">
          {clause.title}
        </button>
      )}
      <div className="mt-2 rounded-xl bg-sand-50 p-3">
        <Diff from={p.originalText} to={p.newText} />
      </div>
      {p.comment && (
        <p className="mt-2 flex gap-1.5 text-sm text-slate-700">
          <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden />
          <span>{p.comment}</span>
        </p>
      )}
      {p.status !== 'open' && p.resolvedByName && (
        <p className="mt-2 text-xs text-slate-500">
          {PROPOSAL_STATUS[p.status].label} przez {p.resolvedByName} · {formatRelative(p.resolvedAt!)}
        </p>
      )}
      {p.status === 'open' && canAct && (
        <div className="mt-3 flex flex-wrap gap-2">
          {mine ? (
            <Button size="sm" variant="ghost" icon={<Undo2 className="size-3.5" />} onClick={() => onResolve('withdrawn')}>
              Wycofaj
            </Button>
          ) : (
            <>
              <Button size="sm" variant="accent" icon={<Check className="size-3.5" />} onClick={() => onResolve('accepted')}>
                Akceptuj zmianę
              </Button>
              <Button size="sm" variant="secondary" icon={<X className="size-3.5" />} onClick={() => onResolve('rejected')}>
                Odrzuć
              </Button>
              {onCounter && (
                <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={onCounter}>
                  Kontrpropozycja
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </article>
  )
}
