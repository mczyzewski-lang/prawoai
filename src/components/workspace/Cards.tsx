import { useState } from 'react'
import { AlertOctagon, AlertTriangle, Check, CircleHelp, FilePlus2, Info, Lock, Pencil, RotateCcw, Undo2, X } from 'lucide-react'
import type { Clause, Finding, PartyId, Proposal } from '../../types'
import { cx, formatRelative } from '../../lib/utils'
import { Avatar, Badge, Button } from '../ui'
import { Diff } from './Diff'

export const SEVERITY_META = {
  high: { label: 'Wysokie ryzyko', tone: 'red' as const, Icon: AlertOctagon, bar: 'bg-red-500' },
  medium: { label: 'Do sprawdzenia', tone: 'amber' as const, Icon: AlertTriangle, bar: 'bg-amber-500' },
  low: { label: 'Wskazówka', tone: 'sky' as const, Icon: Info, bar: 'bg-sky-500' },
}

const CATEGORY_LABEL: Record<Finding['category'], string> = {
  ryzyko: 'Potencjalne ryzyko',
  niejasność: 'Niejasny zapis',
  brak: 'Brakujące postanowienie',
  termin: 'Termin',
  płatność: 'Płatność',
}

export function FindingCard({
  f,
  clause,
  onDecide,
  onSelectClause,
  shared,
  compact,
}: {
  f: Finding
  clause?: Clause
  onDecide: (decision: 'accept' | 'reject' | 'edit' | 'reset', text?: string) => void
  onSelectClause?: () => void
  shared: boolean
  compact?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(f.editedText ?? f.suggestion)
  const m = SEVERITY_META[f.severity]
  const done = f.status !== 'pending'
  return (
    <article className={cx('relative overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200', done && 'opacity-80')} aria-label={`Uwaga: ${f.title}`}>
      <span className={cx('absolute inset-y-0 left-0 w-1', m.bar)} aria-hidden />
      <div className="p-4 pl-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={m.tone}>
            <m.Icon className="size-3" aria-hidden />
            {m.label}
          </Badge>
          <Badge tone="slate">{CATEGORY_LABEL[f.category]}</Badge>
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-500" title="Widoczne tylko dla Ciebie">
            <Lock className="size-3" aria-hidden /> prywatne
          </span>
        </div>
        <h4 className="mt-2 font-semibold text-ink-900">{f.title}</h4>
        {!compact && clause && onSelectClause && (
          <button type="button" onClick={onSelectClause} className="mt-0.5 text-xs font-medium text-brand-700 hover:underline">
            Dotyczy: {clause.title}
          </button>
        )}
        {f.excerpt && f.clauseId && (
          <blockquote className="mt-2 border-l-2 border-slate-200 pl-3 font-serif text-[13.5px] italic leading-relaxed text-slate-600">„{f.excerpt}”</blockquote>
        )}
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{f.explanation}</p>

        <div className="mt-3 rounded-xl bg-brand-50/70 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-800">{f.clauseId ? 'Proponowane brzmienie' : `Proponowany zapis: ${f.excerpt ?? ''}`}</p>
          {editing ? (
            <>
              <label htmlFor={`edit-${f.id}`} className="sr-only">
                Edytuj proponowane brzmienie
              </label>
              <textarea id={`edit-${f.id}`} value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} className="w-full rounded-lg border border-brand-200 bg-white p-2.5 font-serif text-[14px] leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
            </>
          ) : (
            <p className="font-serif text-[14px] leading-relaxed text-ink-900">{f.status === 'edited' ? f.editedText : f.suggestion}</p>
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
        </div>
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
