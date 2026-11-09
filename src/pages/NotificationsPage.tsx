import { useEffect, useMemo, useState } from 'react'
import { Bell } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { EmptyState, PageHeader } from '../components/ui'
import { NotificationItem } from '../components/Notifications'
import { buildNotifications, KIND_GROUP, useNotificationsSeen } from '../lib/notifications'
import { cx } from '../lib/utils'

const FILTERS = ['Wszystkie', 'Umowy', 'Terminy', 'Zespół'] as const

/** /powiadomienia – udostępnienia, sugestie, podpisy, terminy i działania zespołu. */
export default function NotificationsPage() {
  const { state } = useStore()
  const items = useMemo(() => buildNotifications(state), [state])
  const { markAll, isUnread } = useNotificationsSeen()
  // Zapamiętujemy, co było nieprzeczytane w chwili wejścia, a potem oznaczamy wszystko jako przeczytane.
  const [unreadIds] = useState(() => new Set(items.filter(isUnread).map((n) => n.id)))
  useEffect(() => {
    markAll()
  }, [markAll])
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Wszystkie')
  const list = items.filter((n) => filter === 'Wszystkie' || KIND_GROUP[n.kind] === filter)
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Konto" title="Powiadomienia" description="Udostępnione i podpisane umowy, sugestie i komentarze drugiej strony, zatwierdzenia zespołu oraz zbliżające się i minione terminy." />
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filtr powiadomień">
        {FILTERS.map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={cx('rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset', filter === f ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-slate-700 ring-slate-300 hover:ring-slate-400')}>
            {f}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<Bell className="size-6" />} title="Brak powiadomień">
          Gdy druga strona coś zaproponuje, podpisze umowę albo zbliży się termin – zobaczysz to tutaj.
        </EmptyState>
      ) : (
        <div className="rounded-2xl bg-white p-2 ring-1 ring-slate-200">
          {list.map((n) => (
            <NotificationItem key={n.id} n={n} unread={unreadIds.has(n.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
