import { Building2, Check, User } from 'lucide-react'
import type { Contract, Party, PartyId } from '../../types'
import { cx, formatDate, formatDateTime } from '../../lib/utils'
import { documentKind, partyRows, splitClauseLines, stageLabel } from '../../lib/documentFormat'
import { HighlightedText, type NumberedFinding } from './Annotations'

/** Mały znak Prawo.ai do nagłówka dokumentu. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cx('size-5', className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#0b2a33" />
      <rect x="7" y="9" width="12" height="15" rx="3" fill="none" stroke="#2fb8a5" strokeWidth="2.4" />
      <rect x="13" y="7" width="12" height="15" rx="3" fill="#0b2a33" stroke="#ffffff" strokeWidth="2.4" />
      <path d="M16.5 14.5l2 2 3.5-4" fill="none" stroke="#2fb8a5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function DocumentHeader({ c }: { c: Contract }) {
  const version = c.versions.length
  const date = c.versions[version - 1]?.createdAt ?? c.createdAt
  const kind = documentKind(c)
  const showKind = kind.toLowerCase() !== c.title.toLowerCase()
  return (
    <header className="relative overflow-hidden border-b border-slate-200/70 px-5 pb-7 pt-5 sm:px-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-brand-300 to-ink-800" aria-hidden />
      <div className="flex items-center justify-between gap-3 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
        <span className="flex items-center gap-2 text-ink-900">
          <BrandMark /> Prawo.ai
        </span>
        <span className="text-right">
          Wersja {version} · {formatDate(date)}
        </span>
      </div>
      <p className="mt-8 text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-700">{stageLabel(c)}</p>
      <h2 className="mx-auto mt-2 max-w-2xl text-balance text-center font-serif text-2xl font-semibold leading-tight text-ink-900 sm:text-[30px]">{c.title}</h2>
      {showKind && <p className="mt-1.5 text-center font-serif text-[15px] italic text-slate-500">{kind}</p>}
      <div className="mx-auto mt-5 flex w-24 items-center gap-1.5" aria-hidden>
        <span className="h-px flex-1 bg-brand-300" />
        <span className="size-1.5 rotate-45 bg-brand-500" />
        <span className="h-px flex-1 bg-brand-300" />
      </div>
    </header>
  )
}

function PartyCard({ p, index, isViewer }: { p: Party; index: number; isViewer: boolean }) {
  const rows = partyRows(p)
  const Icon = p.kind === 'firma' ? Building2 : User
  return (
    <div className="relative bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">
          Strona {index + 1} · {p.role}
        </p>
        {isViewer && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800">Ty</span>}
      </div>
      <div className="mt-2 flex items-start gap-2.5">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-sand-100 text-ink-700" aria-hidden>
          <Icon className="size-4" />
        </span>
        <p className="font-serif text-[18px] font-semibold leading-snug text-ink-900">{p.name || <span className="italic text-slate-400">nie uzupełniono</span>}</p>
      </div>
      {rows.length > 0 && (
        <dl className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm">
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[110px_1fr] gap-2">
              <dt className="text-xs text-slate-500">{r.label}</dt>
              <dd className="min-w-0 text-slate-800 [overflow-wrap:anywhere]">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-3 text-xs italic text-slate-500">zwana/y dalej „{p.role}”</p>
    </div>
  )
}

export function PartiesColumns({ parties, viewer }: { parties: Party[]; viewer?: PartyId }) {
  return (
    <div className="relative">
      <div className="grid gap-px overflow-hidden rounded-2xl bg-slate-200 ring-1 ring-slate-200 sm:grid-cols-2">
        {parties.map((p, i) => (
          <PartyCard key={p.id} p={p} index={i} isViewer={p.id === viewer} />
        ))}
      </div>
      <span className="absolute left-1/2 top-1/2 hidden size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-paper font-serif text-sm italic text-brand-700 shadow-sm ring-1 ring-slate-200 sm:grid" aria-hidden>
        oraz
      </span>
    </div>
  )
}

/** Treść zapisu z ustępami („1.”, „a)”) z wcięciem wiszącym i zakreśleniami komentarzy. */
export function ClauseBody({ text, marks = [], activeId = null, onActivate = () => {}, className }: { text: string; marks?: NumberedFinding[]; activeId?: string | null; onActivate?: (id: string) => void; className?: string }) {
  const lines = splitClauseLines(text)
  return (
    <div className={cx('space-y-2 font-serif text-[15.5px] leading-[1.75] text-slate-800', className)}>
      {lines.map((l, i) => {
        if (l.kind === 'blank') return null
        const lineMarks = marks
          .filter((m) => m.at >= l.offset && m.f.excerpt && m.at + m.f.excerpt.length <= l.offset + l.length)
          .map((m) => ({ ...m, at: m.at - l.offset }))
        const body = lineMarks.length ? <HighlightedText text={l.content} marks={lineMarks} activeId={activeId} onActivate={onActivate} /> : l.content
        if (l.kind === 'para') return <p key={i}>{body}</p>
        return (
          <div key={i} className={cx('grid gap-x-2', l.kind === 'num' ? 'grid-cols-[1.9rem_1fr]' : 'ml-[1.9rem] grid-cols-[1.4rem_1fr]')}>
            <span className={cx('select-none text-right tabular-nums', l.kind === 'num' ? 'font-semibold text-brand-700' : 'text-slate-500')}>{l.marker}</span>
            <p className="min-w-0">{body}</p>
          </div>
        )
      })}
    </div>
  )
}

export function ClauseHeading({ index, title, className }: { index: number; title: string; className?: string }) {
  return (
    <span className={cx('flex items-baseline gap-3', className)}>
      <span className="shrink-0 rounded-md bg-brand-50 px-1.5 py-0.5 font-serif text-[13px] font-semibold tabular-nums text-brand-700 ring-1 ring-inset ring-brand-100">§&nbsp;{index + 1}</span>
      <span className="font-serif text-[17px] font-semibold text-ink-900">{title}</span>
    </span>
  )
}

export function SignatureStrip({ c }: { c: Contract }) {
  return (
    <section className="border-t border-slate-200/70 px-5 py-8 sm:px-10" aria-label="Podpisy stron">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Podpisy stron</p>
      <div className="mt-6 grid gap-8 sm:grid-cols-2">
        {c.parties.map((p) => {
          const sig = c.signatures.find((s) => s.partyId === p.id)
          return (
            <div key={p.id}>
              <div className="flex h-20 items-end justify-center">
                {sig ? <img src={sig.dataUrl} alt={`Podpis: ${sig.signerName}`} className="max-h-20 object-contain" /> : <span className="pb-2 font-serif text-sm italic text-slate-300">miejsce na podpis</span>}
              </div>
              <div className="border-t border-slate-400 pt-2 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">{p.role}</p>
                <p className="font-serif text-[15px] text-ink-900">{p.name}</p>
                {sig ? (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500">
                    <Check className="size-3 text-brand-600" aria-hidden /> {sig.signerName} · {formatDateTime(sig.signedAt)}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-slate-400">oczekuje na podpis</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
        <BrandMark className="size-3.5 opacity-70" /> Dokument przygotowany i uzgadniany w Prawo.ai
      </p>
    </section>
  )
}
