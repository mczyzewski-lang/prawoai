import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, BellOff, CalendarPlus, ChevronLeft, ChevronRight, Hourglass } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { Button, EmptyState, PageHeader } from '../components/ui'
import { DeadlineRow, urgency } from '../components/deadlines/DeadlineParts'
import { allDeadlines, downloadIcs, fromYmd, toYmd, todayYmd, daysUntil, type DeadlineRef } from '../lib/deadlines'
import { notificationsState, requestNotifications } from '../lib/reminders'
import { cx } from '../lib/utils'

const WEEKDAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd']
const monthFmt = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' })

/** Kalendarz terminów ze wszystkich umów + lista z grupami. */
export default function DeadlinesPage() {
  const { state, updateContract } = useStore()
  const items = useMemo(() => allDeadlines(state.contracts), [state.contracts])
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [day, setDay] = useState<string | null>(null)
  const [notif, setNotif] = useState(notificationsState())
  const today = todayYmd()

  const byDate = useMemo(() => {
    const m = new Map<string, DeadlineRef[]>()
    for (const r of items) if (r.d.date) m.set(r.d.date, [...(m.get(r.d.date) ?? []), r])
    return m
  }, [items])

  // siatka miesiąca od poniedziałku
  const cells: (Date | null)[] = []
  const lead = (month.getDay() + 6) % 7
  for (let i = 0; i < lead; i++) cells.push(null)
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(month.getFullYear(), month.getMonth(), i))

  const open = items.filter((r) => !r.d.done)
  const sorted = (xs: DeadlineRef[]) => [...xs].sort((a, b) => (a.d.date || '9999').localeCompare(b.d.date || '9999'))
  const groups: { title: string; items: DeadlineRef[]; tone?: string }[] = day
    ? [{ title: `Terminy w dniu ${fromYmd(day).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}`, items: sorted(byDate.get(day) ?? []) }]
    : [
        { title: 'Po terminie', items: sorted(open.filter((r) => r.d.date && daysUntil(r.d.date) < 0)), tone: 'text-red-700' },
        { title: 'Najbliższe 7 dni', items: sorted(open.filter((r) => r.d.date && daysUntil(r.d.date) >= 0 && daysUntil(r.d.date) <= 7)), tone: 'text-amber-800' },
        { title: 'Najbliższe 60 dni', items: sorted(open.filter((r) => r.d.date && daysUntil(r.d.date) > 7 && daysUntil(r.d.date) <= 60)) },
        { title: 'Później', items: sorted(open.filter((r) => r.d.date && daysUntil(r.d.date) > 60)) },
        { title: 'Data do ustalenia', items: open.filter((r) => !r.d.date) },
        { title: 'Wykonane', items: sorted(items.filter((r) => r.d.done)).reverse() },
      ]

  const toggle = (r: DeadlineRef) => updateContract(r.c.id, (c) => ({ ...c, deadlines: (c.deadlines ?? []).map((x) => (x.id === r.d.id ? { ...x, done: !x.done } : x)) }))

  return (
    <div>
      <PageHeader
        eyebrow="Kalendarz"
        title="Terminy z umów"
        description="Płatności, realizacja, odbiory, gwarancje i okna wypowiedzenia ze wszystkich Twoich umów – z przypomnieniami przed czasem."
        actions={
          items.length > 0 && (
            <Button variant="secondary" icon={<CalendarPlus className="size-4" />} onClick={() => downloadIcs(items, 'prawoai-terminy.ics')}>
              Eksportuj do kalendarza
            </Button>
          )
        }
      />

      {notif !== 'unsupported' && (
        <div className={cx('mb-5 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 ring-1', notif === 'granted' ? 'bg-brand-50/60 ring-brand-100' : 'bg-white ring-slate-200')}>
          {notif === 'granted' ? <Bell className="size-5 text-brand-700" aria-hidden /> : <BellOff className="size-5 text-slate-500" aria-hidden />}
          <p className="min-w-0 flex-1 text-sm text-slate-700">
            {notif === 'granted'
              ? 'Powiadomienia w przeglądarce są włączone – przypomnimy o terminach, gdy Prawo.ai będzie otwarte. Aby dostawać je zawsze, dodaj terminy do swojego kalendarza (Google, Apple, Outlook).'
              : notif === 'denied'
                ? 'Powiadomienia są zablokowane w ustawieniach przeglądarki. Przypomnienia zobaczysz w Prawo.ai albo dodaj terminy do swojego kalendarza.'
                : 'Włącz powiadomienia, a przypomnimy Ci o zbliżających się terminach. Możesz też dodać terminy do swojego kalendarza.'}
          </p>
          {notif === 'default' && (
            <Button size="sm" variant="primary" icon={<Bell className="size-4" />} onClick={async () => setNotif(await requestNotifications())}>
              Włącz powiadomienia
            </Button>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState icon={<Hourglass className="size-6" />} title="Nie masz jeszcze zapisanych terminów" action={<Link to="/umowy" className="font-semibold text-brand-700 hover:underline">Przejdź do umów</Link>}>
          Otwórz umowę, wejdź w zakładkę „Terminy” i kliknij „Odczytaj terminy z umowy” – zbierzemy je tutaj.
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <section aria-label="Kalendarz miesiąca" className="self-start rounded-2xl bg-white p-4 ring-1 ring-slate-200 lg:sticky lg:top-24">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" aria-label="Poprzedni miesiąc" icon={<ChevronLeft className="size-4" />} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
              <p className="font-semibold capitalize text-ink-900">{monthFmt.format(month)}</p>
              <Button variant="ghost" size="sm" aria-label="Następny miesiąc" icon={<ChevronRight className="size-4" />} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400">
              {WEEKDAYS.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (!d) return <span key={`e${i}`} />
                const ymd = toYmd(d)
                const list = (byDate.get(ymd) ?? []).filter((r) => !r.d.done)
                const tone = list.some((r) => urgency(r.d) === 'overdue') ? 'bg-red-500' : list.some((r) => urgency(r.d) === 'soon') ? 'bg-amber-500' : 'bg-brand-500'
                return (
                  <button
                    key={ymd}
                    type="button"
                    onClick={() => setDay(day === ymd ? null : ymd)}
                    aria-pressed={day === ymd}
                    aria-label={`${d.getDate()}${list.length ? `, terminy: ${list.length}` : ''}`}
                    className={cx('relative grid aspect-square place-items-center rounded-lg text-sm transition', day === ymd ? 'bg-ink-900 text-white' : ymd === today ? 'font-bold text-brand-700 ring-1 ring-brand-300' : 'text-slate-700 hover:bg-slate-50', list.length > 0 && day !== ymd && 'font-semibold text-ink-900')}
                  >
                    {d.getDate()}
                    {list.length > 0 && <span className={cx('absolute bottom-1 size-1.5 rounded-full', day === ymd ? 'bg-white' : tone)} aria-hidden />}
                  </button>
                )
              })}
            </div>
            {day && (
              <button type="button" onClick={() => setDay(null)} className="mt-3 text-sm font-medium text-brand-700 hover:underline">
                Pokaż wszystkie terminy
              </button>
            )}
          </section>

          <div className="space-y-5">
            {groups
              .filter((g) => g.items.length)
              .map((g) => (
                <section key={g.title} className="rounded-2xl bg-white px-4 py-2 ring-1 ring-slate-200">
                  <h2 className={cx('pt-2 text-sm font-semibold', g.tone ?? 'text-ink-900')}>
                    {g.title} <span className="font-normal text-slate-400">({g.items.length})</span>
                  </h2>
                  <ul className="divide-y divide-slate-100">
                    {g.items.map((r) => (
                      <DeadlineRow key={r.d.id} d={r.d} contractTitle={r.c.title} href={`/umowy/${r.c.id}?panel=terminy`} onToggle={() => toggle(r)} />
                    ))}
                  </ul>
                </section>
              ))}
            {day && !(byDate.get(day) ?? []).length && <p className="text-sm text-slate-500">Brak terminów w tym dniu.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
