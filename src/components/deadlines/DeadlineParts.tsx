import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, CalendarClock, CalendarPlus, Check, FileCheck2, Hourglass, Loader2, Pencil, Plus, Receipt, RefreshCcw, ShieldCheck, Sparkles, Trash2, Truck, XCircle } from 'lucide-react'
import type { Contract, Deadline, DeadlineKind } from '../../types'
import { Button, EmptyState, Modal, TextArea, TextField } from '../ui'
import { useToast } from '../Toast'
import { getAiStatus } from '../../lib/aiAnalysis'
import { cx, formatDate, uid } from '../../lib/utils'
import { daysUntil, downloadIcs, extractDeadlinesAi, extractDeadlinesRules, KIND_LABEL, mergeDeadlines, referenceDate, relativeLabel, remindFor } from '../../lib/deadlines'

export const KIND_ICON: Record<DeadlineKind, typeof Receipt> = {
  płatność: Receipt,
  wypowiedzenie: XCircle,
  przedłużenie: RefreshCcw,
  realizacja: Truck,
  odbiór: FileCheck2,
  gwarancja: ShieldCheck,
  inne: CalendarClock,
}

/** Kolor terminu zależnie od tego, ile zostało czasu. */
export function urgency(d: Deadline): 'done' | 'overdue' | 'soon' | 'later' | 'undated' {
  if (d.done) return 'done'
  if (!d.date) return 'undated'
  const n = daysUntil(d.date)
  if (n < 0) return 'overdue'
  if (n <= 7) return 'soon'
  return 'later'
}

const URGENCY_CLS = {
  done: 'bg-slate-100 text-slate-500',
  overdue: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  soon: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200',
  later: 'bg-brand-50 text-brand-800',
  undated: 'bg-slate-100 text-slate-600',
}

export function DeadlineRow({ d, contractTitle, onToggle, onEdit, onDelete, onOpenClause, href, collectHref }: { d: Deadline; contractTitle?: string; onToggle?: () => void; onEdit?: () => void; onDelete?: () => void; onOpenClause?: () => void; href?: string; collectHref?: string }) {
  const Icon = KIND_ICON[d.kind]
  const u = urgency(d)
  return (
    <li className={cx('flex items-start gap-3 py-3', d.done && 'opacity-60')}>
      {onToggle ? (
        <button type="button" onClick={onToggle} aria-pressed={!!d.done} aria-label={d.done ? 'Oznacz jako niewykonane' : 'Oznacz jako wykonane'} className={cx('mt-0.5 grid size-6 shrink-0 place-items-center rounded-md ring-1 ring-inset transition', d.done ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-transparent ring-slate-300 hover:text-slate-300')}>
          <Check className="size-4" aria-hidden />
        </button>
      ) : null}
      <span className={cx('grid size-9 shrink-0 place-items-center rounded-xl', URGENCY_CLS[u])} aria-hidden>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cx('font-medium text-ink-900', d.done && 'line-through')}>
          {href ? (
            <Link to={href} className="hover:underline">
              {d.title}
            </Link>
          ) : (
            d.title
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span className={cx('rounded-full px-2 py-0.5 font-semibold', URGENCY_CLS[u])}>{d.date ? `${formatDate(d.date)} · ${d.done ? 'wykonane' : relativeLabel(d.date)}` : 'data do ustalenia'}</span>
          <span>{KIND_LABEL[d.kind]}</span>
          {d.approximate && <span title="Wyliczone od daty podpisania – sprawdź">≈ wyliczone</span>}
          {d.remind.length > 0 && d.date && !d.done && (
            <span className="inline-flex items-center gap-1">
              <BellRing className="size-3" aria-hidden /> {d.remind.map((n) => (n === 0 ? 'w dniu' : `${n} d.`)).join(', ')} przed
            </span>
          )}
          {contractTitle && <span className="truncate">· {contractTitle}</span>}
        </p>
        {d.basis && (
          <p className="mt-1 line-clamp-2 text-xs italic text-slate-500">
            „{d.basis}”
            {onOpenClause && d.clauseId && (
              <button type="button" onClick={onOpenClause} className="ml-1 not-italic font-medium text-brand-700 hover:underline">
                pokaż w umowie
              </button>
            )}
          </p>
        )}
        {collectHref && d.kind === 'płatność' && !d.done && d.date && daysUntil(d.date) < 0 && (
          <Link to={collectHref} className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-100">
            Nie zapłacono? Rozpocznij windykację →
          </Link>
        )}
      </div>
      {(onEdit || onDelete) && (
        <div className="flex shrink-0 gap-0.5">
          {onEdit && <Button variant="ghost" size="sm" aria-label={`Edytuj: ${d.title}`} icon={<Pencil className="size-4" />} onClick={onEdit} />}
          {onDelete && <Button variant="ghost" size="sm" aria-label={`Usuń: ${d.title}`} icon={<Trash2 className="size-4" />} onClick={onDelete} />}
        </div>
      )}
    </li>
  )
}

const REMIND_OPTIONS = [0, 1, 3, 7, 14, 30, 60, 90]

export function DeadlineModal({ initial, onClose, onSave }: { initial: Deadline; onClose: () => void; onSave: (d: Deadline) => void }) {
  const [d, setD] = useState<Deadline>(initial)
  const set = (patch: Partial<Deadline>) => setD((x) => ({ ...x, ...patch }))
  return (
    <Modal
      open
      onClose={onClose}
      title={initial.title ? 'Edytuj termin' : 'Nowy termin'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Anuluj
          </Button>
          <Button variant="primary" disabled={!d.title.trim()} onClick={() => onSave({ ...d, title: d.title.trim(), approximate: d.date === initial.date ? d.approximate : false })}>
            Zapisz
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <TextField label="Co trzeba zrobić" value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="np. Zapłata drugiej raty" />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Data" type="date" value={d.date} onChange={(e) => set({ date: e.target.value })} />
          <div>
            <label htmlFor="dl-kind" className="mb-1.5 block text-sm font-medium text-slate-800">
              Rodzaj
            </label>
            <select id="dl-kind" value={d.kind} onChange={(e) => set({ kind: e.target.value as DeadlineKind, remind: initial.title ? d.remind : remindFor(e.target.value as DeadlineKind) })} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100">
              {(Object.keys(KIND_LABEL) as DeadlineKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-800">Przypomnij</legend>
          <div className="flex flex-wrap gap-1.5">
            {REMIND_OPTIONS.map((n) => {
              const on = d.remind.includes(n)
              return (
                <button key={n} type="button" aria-pressed={on} onClick={() => set({ remind: on ? d.remind.filter((x) => x !== n) : [...d.remind, n].sort((a, b) => b - a) })} className={cx('rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset', on ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-slate-700 ring-slate-300 hover:ring-slate-400')}>
                  {n === 0 ? 'w dniu terminu' : n === 1 ? '1 dzień przed' : `${n} dni przed`}
                </button>
              )
            })}
          </div>
        </fieldset>
        <TextArea label="Notatka" rows={2} value={d.basis ?? ''} onChange={(e) => set({ basis: e.target.value })} optional />
      </div>
    </Modal>
  )
}

/** Zakładka „Terminy” w umowie. */
export function DeadlinesPanel({ c, onChange, onOpenClause }: { c: Contract; onChange: (fn: (d: Deadline[] | undefined) => Deadline[]) => void; onOpenClause: (clauseId: string) => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState<Deadline | null>(null)
  const list = [...(c.deadlines ?? [])].sort((a, b) => Number(!!a.done) - Number(!!b.done) || (a.date || '9999').localeCompare(b.date || '9999'))
  const ref = referenceDate(c)

  const extract = async () => {
    setBusy(true)
    try {
      let fresh: typeof list
      let viaAi = false
      if ((await getAiStatus()).ai) {
        try {
          fresh = await extractDeadlinesAi(c)
          viaAi = true
        } catch {
          fresh = extractDeadlinesRules(c)
        }
      } else fresh = extractDeadlinesRules(c)
      onChange((old) => mergeDeadlines(old, fresh))
      toast(fresh.length ? `Znaleziono ${fresh.length} ${fresh.length === 1 ? 'termin' : fresh.length < 5 ? 'terminy' : 'terminów'}${viaAi ? '' : ' (odczyt podstawowy)'}` : 'Nie znaleziono terminów z datą – dodaj je ręcznie')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-ink-900">Terminy z umowy</h3>
          <p className="text-xs text-slate-500">Przypomnimy Ci o nich w Prawo.ai i w przeglądarce. Terminy względne liczymy od: {ref.label} ({formatDate(ref.date)}).</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="accent" loading={busy} icon={busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} onClick={extract}>
          {list.some((d) => d.source !== 'ręcznie') ? 'Odczytaj ponownie' : 'Odczytaj terminy z umowy'}
        </Button>
        <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => setEdit({ id: uid('dl'), title: '', date: '', kind: 'inne', source: 'ręcznie', remind: [7, 1] })}>
          Dodaj
        </Button>
        {list.some((d) => d.date && !d.done) && (
          <Button size="sm" variant="ghost" icon={<CalendarPlus className="size-4" />} onClick={() => downloadIcs(list.map((d) => ({ d, c })), `terminy-${c.title.slice(0, 40).replace(/[^\p{L}\d]+/gu, '-')}.ics`)}>
            Do kalendarza
          </Button>
        )}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<Hourglass className="size-6" />} title="Brak zapisanych terminów" className="mt-4 py-8">
          Odczytamy z umowy płatności, terminy realizacji, odbioru, gwarancji i wypowiedzenia – i przypomnimy o nich przed czasem.
        </EmptyState>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100">
          {list.map((d) => (
            <DeadlineRow
              key={d.id}
              d={d}
              onToggle={() => onChange((old) => (old ?? []).map((x) => (x.id === d.id ? { ...x, done: !x.done } : x)))}
              onEdit={() => setEdit(d)}
              onDelete={() => onChange((old) => (old ?? []).filter((x) => x.id !== d.id))}
              onOpenClause={d.clauseId ? () => onOpenClause(d.clauseId!) : undefined}
              collectHref={`/windykacja/nowa?umowa=${c.id}&termin=${d.id}`}
            />
          ))}
        </ul>
      )}
      {edit && (
        <DeadlineModal
          initial={edit}
          onClose={() => setEdit(null)}
          onSave={(d) => {
            onChange((old) => ((old ?? []).some((x) => x.id === d.id) ? (old ?? []).map((x) => (x.id === d.id ? { ...d, source: x.source === 'ręcznie' ? 'ręcznie' : x.source } : x)) : [...(old ?? []), d]))
            setEdit(null)
          }}
        />
      )}
    </div>
  )
}
