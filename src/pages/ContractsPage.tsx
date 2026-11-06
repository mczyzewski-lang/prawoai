import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bookmark, BookmarkPlus, FilePlus2, FileSearch, FolderOpen, Search, SearchX, Sparkles, Trash2 } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { ContractRow } from '../components/ContractCard'
import { Button, ButtonLink, EmptyState, Modal, PageHeader } from '../components/ui'
import { useToast } from '../components/Toast'
import { toMyTemplate } from '../lib/intake'
import { formatDate } from '../lib/utils'
import type { Contract, MyTemplate } from '../types'
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
      <MyTemplatesSection contracts={all} />
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

/** „Moje wzory” – własne wzory zapisane z umów; użycie na stronie głównej (pole „Stwórz umowę”). */
function MyTemplatesSection({ contracts }: { contracts: Contract[] }) {
  const { state, upsertMyTemplate, deleteMyTemplate } = useStore()
  const toast = useToast()
  const location = useLocation()
  const templates = state.myTemplates ?? []
  const [addOpen, setAddOpen] = useState(false)
  const [pick, setPick] = useState<string>('')
  const [name, setName] = useState('')
  const [toDelete, setToDelete] = useState<MyTemplate | null>(null)

  useEffect(() => {
    if (location.hash === '#moje-wzory') requestAnimationFrame(() => document.getElementById('moje-wzory')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [location.hash])

  const other = (t: MyTemplate) => t.parties.find((p) => p.id !== t.ownerPartyId)
  const save = () => {
    const c = contracts.find((x) => x.id === pick)
    if (!c) return
    upsertMyTemplate(toMyTemplate(c, name))
    setAddOpen(false)
    toast('Wzór zapisany – wybierzesz go w polu „Stwórz umowę”')
  }

  return (
    <section id="moje-wzory" className="mb-6 scroll-mt-24 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5" aria-labelledby="mw-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="mw-h" className="flex items-center gap-2 font-semibold text-ink-900">
            <Bookmark className="size-4 text-brand-700" aria-hidden /> Moje wzory
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">Twoje sprawdzone umowy do ponownego użycia – wklejasz tylko dane drugiej strony albo wskazujesz ją przez „@”.</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<BookmarkPlus className="size-4" />}
          disabled={contracts.length === 0}
          onClick={() => {
            setPick(contracts[0]?.id ?? '')
            setName(contracts[0]?.title ?? '')
            setAddOpen(true)
          }}
        >
          Dodaj wzór z umowy
        </Button>
      </div>

      {templates.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">Nie masz jeszcze własnych wzorów. Zapisz dowolną umowę jako wzór – przyciskiem powyżej albo „Zapisz jako mój wzór” w widoku umowy.</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-xl bg-sand-50 px-3 py-2.5 ring-1 ring-slate-200">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-brand-700 ring-1 ring-slate-200" aria-hidden>
                <Bookmark className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink-900">{t.name}</span>
                <span className="block truncate text-xs text-slate-500">
                  {t.clauses.length} zapisów · zapisano {formatDate(t.createdAt)}
                  {other(t)?.name ? ` · ostatnio: ${other(t)!.name}` : ''}
                </span>
              </span>
              <Link to={`/?wzor=${t.id}`} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700">
                <Sparkles className="size-3.5" aria-hidden /> Użyj
              </Link>
              <button type="button" onClick={() => setToDelete(t)} className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-white hover:text-red-600" aria-label={`Usuń wzór: ${t.name}`}>
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Dodaj mój wzór"
        description="Wybierz umowę, której treść chcesz wykorzystywać ponownie. Twoje dane zostaną, dane drugiej strony podmienisz przy tworzeniu kolejnej umowy."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Anuluj
            </Button>
            <Button variant="primary" disabled={!pick || !name.trim()} onClick={save}>
              Zapisz wzór
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label htmlFor="mw-src" className="mb-1 block text-sm font-medium text-slate-700">
              Umowa źródłowa
            </label>
            <select
              id="mw-src"
              value={pick}
              onChange={(e) => {
                setPick(e.target.value)
                setName(contracts.find((c) => c.id === e.target.value)?.title ?? '')
              }}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
            >
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="mw-name" className="mb-1 block text-sm font-medium text-slate-700">
              Nazwa wzoru
            </label>
            <input id="mw-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Np. Montaż pompy ciepła – klient indywidualny" className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Usunąć wzór?"
        description={toDelete ? `„${toDelete.name}” zniknie z listy Twoich wzorów. Umowy utworzone z tego wzoru zostaną bez zmian.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Anuluj
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (toDelete) deleteMyTemplate(toDelete.id)
                setToDelete(null)
                toast('Wzór usunięty')
              }}
            >
              Usuń
            </Button>
          </>
        }
      >
        <span />
      </Modal>
    </section>
  )
}
