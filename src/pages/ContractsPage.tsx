import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bookmark, BookmarkPlus, ClipboardPaste, FilePlus2, FileSearch, FileUp, FolderOpen, Loader2, Search, SearchX, Sparkles, Trash2, Upload } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { ContractRow } from '../components/ContractCard'
import { Button, ButtonLink, EmptyState, Modal, PageHeader, Tabs, TextArea, TextField } from '../components/ui'
import { useToast } from '../components/Toast'
import { toMyTemplate } from '../lib/intake'
import { formatDate, nowIso, uid, wordCount } from '../lib/utils'
import { analyzeContract, normalizeContractText, parseClauses } from '../lib/analyzer'
import { extractText, ExtractError } from '../lib/extract'
import type { Contract, MyTemplate, Party, PartyId } from '../types'
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
      <h2 className="mb-3 flex items-center gap-2 border-t border-slate-200 pt-8 text-lg font-semibold text-ink-900">
        <FolderOpen className="size-5 text-brand-700" aria-hidden /> Umowy
        {all.length > 0 && <span className="rounded-full bg-slate-100 px-2 text-sm font-medium text-slate-600">{all.length}</span>}
      </h2>
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

/** „Moje wzory” – własne wzory zapisane z umów, tekstu lub pliku; użycie na stronie głównej (pole „Stwórz umowę”). */
function MyTemplatesSection({ contracts }: { contracts: Contract[] }) {
  const { state, upsertMyTemplate, deleteMyTemplate } = useStore()
  const toast = useToast()
  const location = useLocation()
  const templates = state.myTemplates ?? []
  const [addOpen, setAddOpen] = useState(false)
  const [toDelete, setToDelete] = useState<MyTemplate | null>(null)

  useEffect(() => {
    if (location.hash === '#moje-wzory') requestAnimationFrame(() => document.getElementById('moje-wzory')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [location.hash])

  const other = (t: MyTemplate) => t.parties.find((p) => p.id !== t.ownerPartyId)
  const me = (t: MyTemplate) => t.parties.find((p) => p.id === t.ownerPartyId)

  return (
    <section id="moje-wzory" className="mb-10 scroll-mt-24" aria-labelledby="mw-h">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="mw-h" className="flex items-center gap-2 text-lg font-semibold text-ink-900">
            <Bookmark className="size-5 text-brand-700" aria-hidden /> Moje wzory
            {templates.length > 0 && <span className="rounded-full bg-brand-50 px-2 text-sm font-medium text-brand-800">{templates.length}</span>}
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">Twoje sprawdzone umowy do ponownego użycia – przy kolejnej wklejasz tylko dane drugiej strony albo wskazujesz ją przez „@”.</p>
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <li key={t.id} className="flex flex-col rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink-900 text-brand-300" aria-hidden>
                <Bookmark className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-semibold leading-snug text-ink-900">{t.name}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {t.clauses.length} zapisów · {formatDate(t.createdAt)}
                </p>
              </div>
              <button type="button" onClick={() => setToDelete(t)} className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-red-600" aria-label={`Usuń wzór: ${t.name}`}>
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
            <p className="mt-3 truncate text-xs text-slate-500">
              Ty: {me(t)?.role ?? '—'}
              {other(t)?.name ? ` · ostatnio z: ${other(t)!.name}` : ''}
            </p>
            <Link to={`/?wzor=${t.id}`} className="mt-3 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700">
              <Sparkles className="size-4" aria-hidden /> Utwórz umowę z tego wzoru
            </Link>
          </li>
        ))}
        <li className={templates.length ? '' : 'sm:col-span-2 lg:col-span-3'}>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className={cx('group flex h-full min-h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-5 text-center transition hover:border-brand-400 hover:bg-brand-50/40', !templates.length && 'py-10')}
          >
            <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700 transition group-hover:scale-105" aria-hidden>
              <BookmarkPlus className="size-5" />
            </span>
            <span className="font-semibold text-ink-900">Dodaj swój wzór umowy</span>
            <span className="max-w-sm text-sm text-slate-500">Wklej tekst, wgraj plik PDF lub DOCX albo zapisz jedną ze swoich umów.</span>
          </button>
        </li>
      </ul>

      {addOpen && (
        <AddTemplateModal
          contracts={contracts}
          onClose={() => setAddOpen(false)}
          onSave={(t) => {
            upsertMyTemplate(t)
            setAddOpen(false)
            toast('Wzór zapisany – wybierzesz go przy „Generuj bezpłatnie” na stronie głównej')
          }}
        />
      )}

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

type Source = 'paste' | 'file' | 'contract'

/** Dodanie własnego wzoru: z wklejonego tekstu, z pliku albo z istniejącej umowy. */
function AddTemplateModal({ contracts, onClose, onSave }: { contracts: Contract[]; onClose: () => void; onSave: (t: MyTemplate) => void }) {
  const [source, setSource] = useState<Source>('paste')
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [pick, setPick] = useState(contracts[0]?.id ?? '')
  const [name, setName] = useState('')
  const [mySide, setMySide] = useState<PartyId>('A')

  const parsed = useMemo(() => {
    if (source === 'contract' || wordCount(text) < 30) return null
    const clean = normalizeContractText(text)
    const clauses = parseClauses(clean)
    const a = analyzeContract(clean, clauses, fileName ?? 'Wklejony tekst')
    return { clauses, parties: a.parties, type: a.contractType }
  }, [text, source, fileName])

  const roles = parsed ? [parsed.parties[0]?.role || 'Strona 1', parsed.parties[1]?.role || 'Strona 2'] : ['Strona 1', 'Strona 2']
  const suggestedName = source === 'contract' ? (contracts.find((c) => c.id === pick)?.title ?? '') : (parsed?.clauses[0]?.title && parsed.type ? parsed.type : fileName?.replace(/\.[^.]+$/, '') ?? '')

  const save = () => {
    const finalName = (name || suggestedName).trim()
    if (source === 'contract') {
      const c = contracts.find((x) => x.id === pick)
      if (c) onSave(toMyTemplate(c, finalName))
      return
    }
    if (!parsed) return
    const toParty = (i: 0 | 1): Party => {
      const p = parsed.parties[i]
      return { id: i === 0 ? 'A' : 'B', role: roles[i], kind: p?.kind ?? 'osoba', name: p && !/nie wskazano/i.test(p.name) ? p.name : '', idNumber: p?.idNumber ?? '', address: p?.address ?? '', email: '', representative: p?.representative ?? '' }
    }
    onSave({ id: uid('mt'), name: finalName || 'Mój wzór', createdAt: nowIso(), ownerPartyId: mySide, parties: [toParty(0), toParty(1)], clauses: parsed.clauses })
  }

  const canSave = source === 'contract' ? !!pick : !!parsed && parsed.clauses.length > 0

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Dodaj swój wzór umowy"
      description="Treść wzoru zostanie zachowana, a przy tworzeniu kolejnej umowy podmienisz tylko dane drugiej strony."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Anuluj
          </Button>
          <Button variant="primary" disabled={!canSave} onClick={save} icon={<BookmarkPlus className="size-4" />}>
            Zapisz wzór
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Tabs<Source>
          label="Źródło wzoru"
          value={source}
          onChange={setSource}
          tabs={[
            { id: 'paste', label: 'Wklej tekst', icon: <ClipboardPaste className="size-4" aria-hidden /> },
            { id: 'file', label: 'Wgraj plik', icon: <FileUp className="size-4" aria-hidden /> },
            ...(contracts.length ? [{ id: 'contract' as Source, label: 'Z mojej umowy', icon: <FolderOpen className="size-4" aria-hidden /> }] : []),
          ]}
          className="w-fit"
        />

        {source === 'paste' && <TextArea label="Treść umowy" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Wklej pełną treść swojej umowy…" className="font-serif" />}

        {source === 'file' && (
          <div>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-sand-50 px-4 py-8 text-center hover:border-brand-400">
              {reading ? <Loader2 className="size-6 animate-spin text-brand-600" aria-hidden /> : <Upload className="size-6 text-brand-600" aria-hidden />}
              <span className="font-medium text-ink-900">{fileName ?? 'Wybierz plik PDF, DOCX lub TXT'}</span>
              <span className="text-xs text-slate-500">{fileName && text ? `Odczytano ok. ${wordCount(text)} słów` : 'Plik jest odczytywany w Twojej przeglądarce.'}</span>
              <input
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  setFileError(null)
                  setReading(true)
                  setFileName(f.name)
                  try {
                    setText(await extractText(f))
                  } catch (err) {
                    setText('')
                    setFileError(err instanceof ExtractError ? err.message : 'Nie udało się odczytać pliku.')
                  } finally {
                    setReading(false)
                  }
                }}
              />
            </label>
            {fileError && <p className="mt-2 text-sm text-red-700">{fileError}</p>}
          </div>
        )}

        {source === 'contract' && (
          <div>
            <label htmlFor="mw-src" className="mb-1 block text-sm font-medium text-slate-700">
              Umowa źródłowa
            </label>
            <select id="mw-src" value={pick} onChange={(e) => setPick(e.target.value)} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100">
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {source !== 'contract' && parsed && (
          <div className="rounded-xl bg-brand-50/60 p-3 ring-1 ring-brand-100">
            <p className="text-sm text-slate-700">
              Rozpoznano <span className="font-semibold">{parsed.clauses.length}</span> zapisów{parsed.type ? ` · ${parsed.type}` : ''}.
            </p>
            <fieldset className="mt-2">
              <legend className="text-sm font-medium text-ink-900">Którą stroną jesteś w tej umowie?</legend>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(['A', 'B'] as PartyId[]).map((id, i) => (
                  <label key={id} className={cx('cursor-pointer rounded-xl px-3 py-2 text-sm ring-1 ring-inset', mySide === id ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-slate-700 ring-slate-300')}>
                    <input type="radio" name="my-side" className="sr-only" checked={mySide === id} onChange={() => setMySide(id)} />
                    {roles[i]}
                    {parsed.parties[i]?.name && !/nie wskazano/i.test(parsed.parties[i].name) ? ` (${parsed.parties[i].name})` : ''}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}
        {source !== 'contract' && text && !parsed && <p className="text-sm text-amber-800">Tekst jest za krótki, aby zapisać go jako wzór umowy.</p>}

        <TextField label="Nazwa wzoru" value={name} onChange={(e) => setName(e.target.value)} placeholder={suggestedName || 'Np. Montaż pompy ciepła – klient indywidualny'} hint="Pod tą nazwą wybierzesz wzór przy tworzeniu umowy." />
      </div>
    </Modal>
  )
}
