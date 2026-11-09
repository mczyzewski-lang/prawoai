import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CalendarClock, CheckCircle2, FileSignature, FileText, MessageSquare, PenLine, Scale, Users, Banknote } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { buildNotifications, type AppNotification, type NotificationKind, useNotificationsSeen } from '../lib/notifications'
import { cx, formatRelative } from '../lib/utils'

export const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  umowa: FileText,
  podpis: FileSignature,
  sugestia: PenLine,
  komentarz: MessageSquare,
  zespół: Users,
  termin: CalendarClock,
  prawnik: Scale,
  windykacja: Banknote,
}

const TONE: Record<AppNotification['tone'], string> = {
  info: 'bg-brand-50 text-brand-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
}

export function NotificationItem({ n, unread, onClick }: { n: AppNotification; unread: boolean; onClick?: () => void }) {
  const Icon = KIND_ICON[n.kind]
  return (
    <Link to={n.href} onClick={onClick} className={cx('flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50', unread && 'bg-brand-50/40')}>
      <span className={cx('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg', TONE[n.tone])} aria-hidden>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-snug text-ink-900">{n.kind === 'termin' ? n.title : n.text}</span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">
          {n.kind === 'termin' ? n.text : n.title} · {formatRelative(n.at)}
        </span>
      </span>
      {unread && <span className="mt-2 size-2 shrink-0 rounded-full bg-brand-500" aria-label="nieprzeczytane" />}
    </Link>
  )
}

/** Dzwonek w nagłówku: licznik nieprzeczytanych i lista najnowszych powiadomień. */
export function NotificationBell() {
  const { state } = useStore()
  const items = useMemo(() => buildNotifications(state), [state])
  const { markAll, isUnread } = useNotificationsSeen()
  const unread = items.filter(isUnread).length
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} aria-label={`Powiadomienia${unread ? ` – nieprzeczytane: ${unread}` : ''}`} className="relative grid size-10 place-items-center rounded-full text-slate-700 transition hover:bg-ink-900/5 hover:text-ink-900">
        <Bell className="size-5" aria-hidden />
        {unread > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-sand-50">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Powiadomienia" className="animate-fade-up absolute right-0 top-12 z-40 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl bg-white p-2 shadow-xl ring-1 ring-slate-200">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="font-semibold text-ink-900">Powiadomienia</p>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="text-xs font-medium text-brand-700 hover:underline">
                Oznacz jako przeczytane
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="flex items-center gap-2 px-3 py-6 text-sm text-slate-500">
              <CheckCircle2 className="size-4" aria-hidden /> Nic nowego – wszystko pod kontrolą.
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              {items.slice(0, 8).map((n) => (
                <NotificationItem key={n.id} n={n} unread={isUnread(n)} onClick={() => setOpen(false)} />
              ))}
            </div>
          )}
          <Link to="/powiadomienia" onClick={() => setOpen(false)} className="mt-1 block rounded-xl px-3 py-2 text-center text-sm font-medium text-brand-700 hover:bg-brand-50">
            Zobacz wszystkie
          </Link>
        </div>
      )}
    </div>
  )
}
