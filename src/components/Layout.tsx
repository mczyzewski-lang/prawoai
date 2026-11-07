import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BellRing, BookUser, CalendarClock, FileSearch, FolderOpen, Layers, X, Home, LayoutTemplate, MessagesSquare, RotateCcw, ShieldCheck, UserCog } from 'lucide-react'
import { ProfileModal } from './ProfileModal'
import { Wordmark } from './BrandSymbol'
import { useStore } from '../store/AppStore'
import { Alert, Avatar, Button, Modal } from './ui'
import { cx } from '../lib/utils'
import { useToast } from './Toast'
import { useReminders } from '../lib/reminders'
import { allDeadlines, daysUntil, relativeLabel } from '../lib/deadlines'

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return <Wordmark light={light} className={cx('text-[22px]', className)} />
}

const NAV = [
  { to: '/', label: 'Start', short: 'Start', icon: Home, end: true },
  { to: '/wzory', label: 'Wzory umów', short: 'Wzory', icon: LayoutTemplate },
  { to: '/analiza', label: 'Analizuj umowę', short: 'Analizuj', icon: FileSearch },
  { to: '/asystent', label: 'Asystent AI', short: 'Asystent', icon: MessagesSquare },
  { to: '/umowy', label: 'Moje umowy', short: 'Umowy', icon: FolderOpen },
]
/** Tylko w nawigacji desktopowej (na telefonie – w menu konta). */
const NAV_EXTRA = [
  { to: '/terminy', label: 'Terminy', icon: CalendarClock },
  { to: '/inne', label: 'Inne', icon: Layers },
]

function ProfileMenu() {
  const { state, resetDemo } = useStore()
  const [profileOpen, setProfileOpen] = useState(false)
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
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
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2 rounded-full p-1 pr-1 hover:bg-ink-900/5 md:pr-3" aria-label="Menu konta">
        <Avatar name={state.profile.name} size="sm" />
        <span className="hidden text-sm font-medium text-ink-900 lg:inline">{state.profile.name}</span>
      </button>
      {open && (
        <div role="menu" className="animate-fade-up absolute right-0 top-11 z-40 w-72 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-slate-200">
          <div className="px-3 py-2">
            <p className="text-sm font-semibold text-ink-900">{state.profile.name}</p>
            <p className="truncate text-xs text-slate-500">{state.profile.email}</p>
          </div>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false)
              setProfileOpen(true)
            }}
            className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <UserCog className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Mój profil i dane
              <span className="block truncate text-xs text-slate-500">{state.profile.ownParty ? `Dane do umów: ${state.profile.ownParty.name}` : 'Brak zapisanych danych do umów'}</span>
            </span>
          </button>
          <Link role="menuitem" to="/dane" onClick={() => setOpen(false)} className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <BookUser className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Adresy i dane
              <span className="block text-xs text-slate-500">Osoby, sprzęt i inne dane do wstawiania przez @</span>
            </span>
          </Link>
          <Link role="menuitem" to="/terminy" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 md:hidden">
            <CalendarClock className="size-4" aria-hidden /> Terminy z umów
          </Link>
          <Link role="menuitem" to="/inne" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 md:hidden">
            <Layers className="size-4" aria-hidden /> Inne – założenia i backlog
          </Link>
          <div className="my-1 h-px bg-slate-100" />
          <Link role="menuitem" to="/umowy" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <FolderOpen className="size-4" aria-hidden /> Moje umowy
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false)
              setConfirm(true)
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="size-4" aria-hidden /> Przywróć dane przykładowe
          </button>
        </div>
      )}
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Przywrócić dane przykładowe?"
        description="Twoje umowy, analizy i rozmowy zapisane w tej przeglądarce zostaną zastąpione przykładowymi."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Anuluj
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                resetDemo()
                setConfirm(false)
                toast('Przywrócono dane przykładowe')
              }}
            >
              Przywróć
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Tej operacji nie można cofnąć.</p>
      </Modal>
    </div>
  )
}

export function AppLayout() {
  const { state, loadError, dismissLoadError, saveError } = useStore()
  const reminders = useReminders(state.contracts)
  const dueSoon = allDeadlines(state.contracts).filter((r) => !r.d.done && r.d.date && daysUntil(r.d.date) <= 7).length
  const location = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded-lg bg-white px-4 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Przejdź do treści
      </a>
      <header className="no-print sticky top-0 z-30 border-b border-slate-200/70 bg-sand-50/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link to="/" aria-label="Prawo.ai – strona główna">
            <Logo />
          </Link>
          <nav aria-label="Główna nawigacja" className="hidden flex-1 items-center gap-1 md:flex">
            {[...NAV.slice(1), ...NAV_EXTRA].map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) => cx('flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition', isActive ? 'bg-ink-900 text-white' : 'text-slate-700 hover:bg-ink-900/5 hover:text-ink-900')}
              >
                <n.icon className="size-4" aria-hidden />
                {n.label}
                {n.to === '/terminy' && dueSoon > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-ink-950">{dueSoon}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto md:ml-0">
            <ProfileMenu />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 md:pb-16 md:pt-8">
        {loadError && (
          <Alert tone="warning" className="mb-4" onClose={dismissLoadError}>
            {loadError}
          </Alert>
        )}
        {saveError && (
          <Alert tone="error" className="mb-4">
            {saveError}
          </Alert>
        )}
        {reminders.active.length > 0 && (
          <section aria-label="Przypomnienia o terminach" className="no-print mb-4 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
            <div className="flex items-center gap-2 px-1">
              <BellRing className="size-4 text-amber-700" aria-hidden />
              <p className="flex-1 text-sm font-semibold text-amber-950">Przypomnienie o terminach</p>
              <button type="button" onClick={() => reminders.dismiss()} className="rounded-lg p-1 text-amber-800 hover:bg-amber-100" aria-label="Zamknij przypomnienia">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <ul className="mt-2 space-y-1.5">
              {reminders.active.slice(0, 4).map((r) => (
                <li key={r.key}>
                  <Link to={`/umowy/${r.ref.c.id}?panel=terminy`} onClick={() => reminders.dismiss(r.key)} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-amber-200/70 hover:ring-amber-400">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink-900">{r.ref.d.title}</span>
                      <span className="block truncate text-xs text-slate-500">{r.ref.c.title}</span>
                    </span>
                    <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold', r.days < 0 ? 'bg-red-50 text-red-700' : 'bg-amber-100 text-amber-900')}>{relativeLabel(r.ref.d.date)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {reminders.active.length > 4 && (
              <Link to="/terminy" onClick={() => reminders.dismiss()} className="mt-2 inline-block px-1 text-sm font-medium text-amber-900 underline">
                Wszystkie terminy ({reminders.active.length})
              </Link>
            )}
          </section>
        )}
        <Outlet />
      </main>

      <footer className="no-print mx-auto hidden max-w-7xl px-6 pb-10 text-xs text-slate-500 md:block">
        <div className="flex items-center gap-2 border-t border-slate-200 pt-6">
          <ShieldCheck className="size-4 text-brand-700" aria-hidden />
          Prawo.ai pomaga zrozumieć i uporządkować sprawy, ale nie zastępuje porady prawnika. Wzory i analizy mają charakter przykładowy.
        </div>
      </footer>

      <nav aria-label="Nawigacja mobilna" className="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', isActive ? 'text-brand-700' : 'text-slate-500')}>
              {({ isActive }) => (
                <>
                  <span className={cx('grid h-7 w-12 place-items-center rounded-full transition', isActive && 'bg-brand-50')}>
                    <n.icon className="size-5" aria-hidden />
                  </span>
                  {n.short}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

export function GuestLayout({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="no-print sticky top-0 z-30 border-b border-slate-200/70 bg-sand-50/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          {right}
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 md:pt-8">
        {children}
      </main>
    </div>
  )
}
