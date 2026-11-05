import { useState } from 'react'
import { FilePlus2, FileSearch, FolderOpen, Search, SearchX } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { ContractRow } from '../components/ContractCard'
import { Button, ButtonLink, EmptyState, PageHeader } from '../components/ui'
import { cx, displayStatus, lastActivity, STATUS_META, type DisplayStatus } from '../lib/utils'

const FILTERS: (DisplayStatus | 'all')[] = ['all', 'awaiting', 'negotiation', 'sent', 'agreed', 'signed', 'draft']

export default function ContractsPage() {
  const { state } = useStore()
  const [filter, setFilter] = useState<DisplayStatus | 'all'>('all')
  const [q, setQ] = useState('')
  const all = [...state.contracts].sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)))
  const list = all.filter((c) => (filter === 'all' || displayStatus(c, c.ownerPartyId) === filter) && (!q || `${c.title} ${c.parties.map((p) => p.name).join(' ')}`.toLowerCase().includes(q.toLowerCase())))
  const count = (f: DisplayStatus) => all.filter((c) => displayStatus(c, c.ownerPartyId) === f).length

  return (
    <div>
      <PageHeader
        eyebrow="Moje umowy"
        title="Twoje dokumenty"
        description="Projekty, negocjacje i podpisane umowy w jednym miejscu."
        actions={
          <>
            <ButtonLink to="/analiza" variant="secondary" icon={<FileSearch className="size-4" />}>
              Analizuj
            </ButtonLink>
            <ButtonLink to="/wzory" variant="accent" icon={<FilePlus2 className="size-4" />}>
              Nowa umowa
            </ButtonLink>
          </>
        }
      />
      {all.length === 0 ? (
        <EmptyState icon={<FolderOpen className="size-6" />} title="Nie masz jeszcze żadnych umów" action={<ButtonLink to="/wzory" variant="accent">Stwórz umowę</ButtonLink>}>
          Tu pojawią się projekty utworzone z kreatora i przeanalizowane dokumenty.
        </EmptyState>
      ) : (
        <>
          <div className="mb-4 space-y-3">
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <label htmlFor="c-search" className="sr-only">
                Szukaj umowy
              </label>
              <input id="c-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj po nazwie lub stronie" className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
            </div>
            <div role="group" aria-label="Filtruj według statusu" className="scrollbar-thin -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
              {FILTERS.map((f) => {
                const n = f === 'all' ? all.length : count(f)
                if (f !== 'all' && n === 0) return null
                return (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={filter === f}
                    onClick={() => setFilter(f)}
                    className={cx('shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset', filter === f ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-slate-700 ring-slate-300 hover:ring-slate-400')}
                  >
                    {f === 'all' ? 'Wszystkie' : STATUS_META[f].label} <span className="opacity-60">{n}</span>
                  </button>
                )
              })}
            </div>
          </div>
          {list.length === 0 ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="Brak umów spełniających kryteria"
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setFilter('all')
                    setQ('')
                  }}
                >
                  Pokaż wszystkie
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-2.5">
              {list.map((c) => (
                <ContractRow key={c.id} c={c} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
