import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowRight, Bookmark, CalendarClock, ChevronRight, EyeOff, FilePlus2, FileSearch, FileText, FolderOpen, Handshake, LayoutTemplate, Link2, Loader2, MessagesSquare, Paperclip, Plus, Sparkles, X } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { ButtonLink, EmptyState, Modal, StatusBadge, Tabs } from '../components/ui'
import { useToast } from '../components/Toast'
import { templateFromText } from '../lib/templateFromText'
import { getTemplate, TEMPLATES } from '../data/templates'
import { cx, displayStatus, formatDate, formatRelative, lastActivity, otherParty, plural } from '../lib/utils'
import { allDeadlines, daysUntil, relativeLabel } from '../lib/deadlines'
import { QUICK_STARTS } from '../lib/intake'
import { useGenerate } from '../components/GenerateOverlay'
import { MentionTextarea } from '../components/MentionTextarea'
import type { MyTemplate } from '../types'
import { extractText, ExtractError } from '../lib/extract'
import { HANDOFF_KEY } from './AnalyzePage'
import type { Contract } from '../types'

export default function HomePage() {
  const { state } = useStore()
  const [prompt, setPrompt] = useState('')
  const contracts = [...state.contracts].sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)))
  const awaiting = contracts.filter((c) => displayStatus(c, c.ownerPartyId) === 'awaiting')
  const firstName = state.profile.name.split(' ')[0]
  const upcoming = allDeadlines(state.contracts)
    .filter((r) => !r.d.done && r.d.date && daysUntil(r.d.date) <= 60)
    .sort((a, b) => a.d.date.localeCompare(b.d.date))
    .slice(0, 4)
  /** Baza nowej umowy: mój wzór, wzór z biblioteki albo wgrany plik. */
  const [attach, setAttach] = useState<Attach | null>(null)
  const myTemplates = state.myTemplates ?? []
  const selectedTpl = attach?.kind === 'my' ? myTemplates.find((t) => t.id === attach.id) : attach?.kind === 'file' ? attach.template : undefined
  const { generate, overlay, busy, contacts } = useGenerate()
  const toast = useToast()
  const [chooserOpen, setChooserOpen] = useState(false)
  // Tryb wynika z tego, co wpiszesz lub dodasz – bez ręcznego przełączania.
  const mode = detectIntent(prompt, attach)
  const navigate = useNavigate()
  /** Analiza: wklejona treść albo dodany plik trafia do „Analizuj umowę” (z Twoim opisem jako kontekstem). */
  const analyze = () => {
    const isFile = attach?.kind === 'file'
    // „Sprawdź tę umowę, jestem najemcą: <treść>” – pierwsza linia z poleceniem trafia jako kontekst oceny.
    const [first, ...rest] = prompt.split('\n')
    const lead = !isFile && ANALYZE_WORDS.test(first) && first.length < 300 && rest.join('\n').trim().length > 0
    const text = isFile ? attach.text : lead ? rest.join('\n') : prompt
    if (!text.trim()) return
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ text, fileName: isFile ? attach.name : null, context: isFile ? prompt.trim() : lead ? first.trim() : '' }))
    navigate('/analiza')
  }
  const run = () => (mode === 'analyze' ? analyze() : start(prompt))
  const [dragOver, setDragOver] = useState(false)
  const addFile = async (f: File) => {
    setFileBusy(true)
    try {
      const text = await extractText(f)
      const tpl = templateFromText(text, f.name.replace(/\.[^.]+$/, ''), state.profile.ownParty)
      if (!tpl) throw new ExtractError('Nie rozpoznaliśmy zapisów umowy w tym pliku.')
      setAttach({ kind: 'file', name: f.name, template: tpl, text })
      document.getElementById('home-prompt')?.focus()
    } catch (err) {
      toast(err instanceof ExtractError ? err.message : 'Nie udało się odczytać pliku.', 'error')
    } finally {
      setFileBusy(false)
    }
  }
  const canRun = mode === 'analyze' ? (attach?.kind === 'file' ? true : prompt.trim().split(/\s+/).length >= 20) : !!prompt.trim()
  const [fileBusy, setFileBusy] = useState(false)
  // „Użyj wzoru” z Moich umów: /?wzor=<id>
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    const id = params.get('wzor')
    if (!id) return
    if (myTemplates.some((t) => t.id === id)) {
      setAttach({ kind: 'my', id })
      requestAnimationFrame(() => document.getElementById('home-prompt')?.focus())
    }
    setParams({}, { replace: true })
  }, [params, setParams, myTemplates])
  const start = (q: string) => {
    if (!q.trim()) return
    if (attach?.kind === 'my') void generate(q, { myTemplateId: attach.id })
    else if (attach?.kind === 'lib') void generate(q, { templateHint: attach.id })
    else if (attach?.kind === 'file') void generate(q, { myTemplate: attach.template })
    else void generate(q)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {overlay}
      <section aria-label="Główne akcje">
        <p className="text-sm font-medium text-brand-700">Dzień dobry, {firstName}</p>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight text-ink-900 sm:text-3xl">Co chcesz dziś zrobić?</h1>
        <div className="mt-5">
          {/* Jedno pole: utwórz albo przeanalizuj – zależnie od tego, co wpiszesz lub dodasz */}
          <div className="relative flex flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 to-ink-800 p-5 text-white shadow-lg sm:p-6">
            <div className="pointer-events-none absolute -right-20 -top-20 size-60 rounded-full bg-brand-500/20 blur-3xl" aria-hidden />
            <div className="relative flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-brand-300" aria-hidden>
                <FilePlus2 className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Stwórz lub sprawdź umowę</h2>
                <p className="text-sm text-white/70">Opisz, jakiej umowy potrzebujesz – albo wklej lub dodaj umowę, a ocenimy ją z Twojej perspektywy.</p>
              </div>
            </div>
            <form
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes('Files')) {
                  e.preventDefault()
                  setDragOver(true)
                }
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const f = e.dataTransfer.files?.[0]
                if (f) void addFile(f)
              }}
              className={cx('relative mt-4 flex-1 rounded-2xl bg-white p-2 shadow-xl transition', dragOver && 'ring-4 ring-brand-300')}
              onSubmit={(e) => {
                e.preventDefault()
                run()
              }}
            >
              <label htmlFor="home-prompt" className="sr-only">
                Opisz umowę, którą chcesz przygotować
              </label>
              <MentionTextarea
                id="home-prompt"
                rows={4}
                value={prompt}
                onChange={setPrompt}
                onSubmit={run}
                contacts={contacts}
                placeholder={mode === 'analyze' && attach?.kind === 'file' ? `Na czym Ci zależy przy „${attach.name}”? (opcjonalnie – np. „jestem zleceniodawcą, ważne są dla mnie terminy”)` : selectedTpl ? `Wklej dane drugiej strony do „${attach?.kind === 'file' ? attach.name : selectedTpl.name}” albo wskaż ją przez @` : attach?.kind === 'lib' ? 'Opisz, na czym Ci zależy – np. strony, kwota, terminy' : 'Np. „Umowa zlecenia z Janem Kowalskim na obsługę stoiska, 3000 zł” – albo wklej tutaj treść umowy do sprawdzenia'}
                boxClassName="rounded-xl border-0 px-3 py-2.5 text-[16px] leading-6"
                inputClassName="text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <div className="flex min-w-0 items-center gap-2 px-1 pb-1">
                <PlusMenu
                  onPickTemplate={() => setChooserOpen(true)}
                  onFile={addFile}
                  busy={fileBusy}
                />
                {attach ? (
                  <span className="inline-flex min-w-0 items-center gap-1.5 rounded-xl bg-brand-50 py-1.5 pl-2.5 pr-1 text-sm font-medium text-brand-800 ring-1 ring-inset ring-brand-200">
                    {attach.kind === 'file' ? <Paperclip className="size-3.5 shrink-0" aria-hidden /> : <Bookmark className="size-3.5 shrink-0" aria-hidden />}
                    <span className="truncate">{attach.kind === 'file' ? attach.name : attach.kind === 'my' ? (selectedTpl?.name ?? 'Mój wzór') : (getTemplate(attach.id)?.name ?? 'Wzór')}</span>
                    <button type="button" onClick={() => setAttach(null)} className="grid size-6 shrink-0 place-items-center rounded-lg hover:bg-brand-100" aria-label="Usuń wybrany wzór lub plik">
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </span>
                ) : (
                  <span className="hidden min-w-0 truncate text-xs text-slate-400 sm:inline">Dodaj umowę do sprawdzenia albo wzór</span>
                )}
                <span className="flex-1" />
                <button type="submit" disabled={!canRun || busy} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40">
                  {mode === 'analyze' ? <FileSearch className="size-4" aria-hidden /> : <Sparkles className="size-4" aria-hidden />} {mode === 'analyze' ? 'Analizuj umowę' : 'Generuj bezpłatnie'}
                </button>
              </div>
            </form>
            <p className="relative mt-2 flex flex-wrap items-center gap-x-2 text-xs text-white/70" aria-live="polite">
              {mode === 'analyze'
                ? attach?.kind === 'file'
                  ? `Ocenimy „${attach.name}” z Twojej perspektywy. Chcesz zamiast tego utworzyć nową umowę na jej bazie? Wpisz dane drugiej strony.`
                  : canRun
                    ? 'Wygląda na treść umowy – ocenimy ją z Twojej perspektywy.'
                    : 'Wklej treść umowy albo dodaj plik przyciskiem (+) – ocenimy ją z Twojej perspektywy.'
                : attach?.kind === 'file'
                  ? `Utworzymy nową umowę na bazie „${attach.name}”.`
                  : prompt.trim().split(/\s+/).length >= 50
                    ? 'Utworzymy nową umowę na podstawie wklejonego tekstu.'
                    : 'Opisz umowę, którą chcesz przygotować – albo wklej treść lub dodaj plik, a ją przeanalizujemy.'}
            </p>
            {chooserOpen && (
              <TemplateChooser
                mine={myTemplates}
                onClose={() => setChooserOpen(false)}
                onPick={(a) => {
                  setAttach(a)
                  setChooserOpen(false)
                  requestAnimationFrame(() => document.getElementById('home-prompt')?.focus())
                }}
              />
            )}
            <div className="relative mt-4 flex flex-wrap gap-2">
              {QUICK_STARTS.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => {
                    setPrompt((cur) => (cur.trim() ? `${q.fill} – ${cur.trim()}` : `${q.fill} `))
                    requestAnimationFrame(() => {
                      const el = document.getElementById('home-prompt') as HTMLTextAreaElement | null
                      el?.focus()
                      el?.setSelectionRange(el.value.length, el.value.length)
                    })
                  }} className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/20">
                  {q.label}
                </button>
              ))}
            </div>
          </div>

        </div>

        <Link to="/asystent" className="group mt-4 flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200 transition hover:ring-brand-300">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700" aria-hidden>
            <MessagesSquare className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink-900">Zapytaj asystenta AI</span>
            <span className="block text-sm text-slate-600">Opisz sprawę prawną – pomożemy ustalić kolejne kroki i potrzebne dokumenty.</span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600" aria-hidden />
        </Link>
      </section>

      {/* 3. Wymaga Twojej uwagi */}
      {awaiting.length > 0 && (
        <section aria-labelledby="attention" className="rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-200 sm:p-5">
          <h2 id="attention" className="flex items-center gap-2 font-semibold text-amber-950">
            <AlertCircle className="size-5 text-amber-600" aria-hidden />
            {awaiting.length} {plural(awaiting.length, 'umowa czeka', 'umowy czekają', 'umów czeka')} na Twoją odpowiedź
          </h2>
          <ul className="mt-3 space-y-2">
            {awaiting.map((c) => (
              <li key={c.id}>
                <Link to={`/umowy/${c.id}`} className="group flex items-center gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-amber-200/70 transition hover:ring-amber-400">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink-900">{c.title}</span>
                    <span className="block truncate text-sm text-slate-600">{c.activity[c.activity.length - 1]?.text}</span>
                  </span>
                  <span className="hidden shrink-0 text-sm font-semibold text-amber-800 group-hover:underline sm:inline">Odpowiedz</span>
                  <ChevronRight className="size-5 shrink-0 text-amber-700" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Najbliższe terminy z umów */}
      {upcoming.length > 0 && (
        <section aria-labelledby="deadlines-h" className="rounded-3xl bg-white p-4 ring-1 ring-slate-200 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="deadlines-h" className="flex items-center gap-2 font-semibold text-ink-900">
              <CalendarClock className="size-5 text-brand-700" aria-hidden /> Najbliższe terminy
            </h2>
            <Link to="/terminy" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-brand-700 hover:bg-brand-50">
              Kalendarz <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <ul className="mt-2 divide-y divide-slate-100">
            {upcoming.map((r) => (
              <li key={r.d.id}>
                <Link to={`/umowy/${r.c.id}?panel=terminy`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-900">{r.d.title}</span>
                    <span className="block truncate text-xs text-slate-500">{r.c.title}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${daysUntil(r.d.date) < 0 ? 'bg-red-50 text-red-700' : daysUntil(r.d.date) <= 7 ? 'bg-amber-50 text-amber-800' : 'bg-brand-50 text-brand-800'}`}>
                    {formatDate(r.d.date)} · {relativeLabel(r.d.date)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 4. Moje umowy */}
      <section aria-labelledby="my-contracts">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 id="my-contracts" className="text-xl font-semibold text-ink-900">
            Moje umowy
          </h2>
          {contracts.length > 0 && (
            <Link to="/umowy" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-brand-700 hover:bg-brand-50">
              Wszystkie ({contracts.length}) <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
        {contracts.length === 0 ? (
          <EmptyState icon={<FolderOpen className="size-6" />} title="Nie masz jeszcze żadnych umów" action={<ButtonLink to="/nowa" variant="accent">Stwórz pierwszą umowę</ButtonLink>}>
            Utwórz umowę z opisu albo przeanalizuj dokument od kontrahenta.
          </EmptyState>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            <div className="hidden grid-cols-[minmax(0,1fr)_200px_130px_20px] gap-4 border-b border-slate-100 bg-sand-50 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
              <span>Dokument</span>
              <span>Status</span>
              <span>Ostatnio</span>
              <span />
            </div>
            <ul className="divide-y divide-slate-100">
              {contracts.slice(0, 6).map((c) => (
                <HomeRow key={c.id} c={c} />
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 5. Zasady */}
      <section aria-label="Jak dbamy o uczciwe negocjacje" className="grid gap-4 border-t border-slate-200 pt-6 text-sm sm:grid-cols-3">
        {[
          { icon: EyeOff, title: 'Prywatne pytania zostają prywatne', text: 'Druga strona widzi tylko wspólne komentarze i propozycje.' },
          { icon: Handshake, title: 'Zmiany tylko za zgodą', text: 'Każda zmiana wymaga akceptacji drugiej strony. Historia wersji jest zawsze dostępna.' },
          { icon: Link2, title: 'Kontrahent bez rejestracji', text: 'Wysyłasz link – druga strona od razu czyta dokument.' },
        ].map((f) => (
          <div key={f.title} className="flex gap-3">
            <f.icon className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
            <div>
              <p className="font-medium text-ink-900">{f.title}</p>
              <p className="mt-0.5 leading-relaxed text-slate-600">{f.text}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}

function HomeRow({ c }: { c: Contract }) {
  const status = displayStatus(c, c.ownerPartyId)
  const other = c.parties.find((p) => p.id === otherParty(c.ownerPartyId))!
  return (
    <li>
      <Link to={`/umowy/${c.id}`} className="group grid grid-cols-[minmax(0,1fr)_20px] items-center gap-x-4 gap-y-2 px-4 py-3.5 transition hover:bg-sand-50 sm:px-5 md:grid-cols-[minmax(0,1fr)_200px_130px_20px]">
        <span className="flex min-w-0 items-center gap-3">
          <span className="hidden size-9 shrink-0 place-items-center rounded-lg bg-sand-100 text-ink-700 sm:grid" aria-hidden>
            <FileText className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-ink-900 group-hover:text-brand-700">{c.title}</span>
            <span className="block truncate text-sm text-slate-500">{other.name || other.role}</span>
          </span>
        </span>
        <ChevronRight className="size-5 text-slate-400 md:order-last" aria-hidden />
        <span className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-1">
          <StatusBadge status={status} />
          <span className="text-xs text-slate-500 md:hidden">{formatRelative(lastActivity(c))}</span>
        </span>
        <span className="hidden text-sm text-slate-600 md:block">{formatRelative(lastActivity(c))}</span>
      </Link>
    </li>
  )
}

type Attach = { kind: 'my'; id: string } | { kind: 'lib'; id: string } | { kind: 'file'; name: string; template: MyTemplate; text: string }

const CONTRACT_MARKERS = /§\s*\d|zawarta\s+w\s+dniu|pomiędzy\s*:|zwan\p{L}*\s+dalej|postanowienia\s+końcowe|niniejsz\p{L}+\s+umow/iu
const ANALYZE_WORDS = /^\s*(przeanalizuj|sprawdź|oceń|zweryfikuj|analiz|co sądzisz|czy (mogę|warto) podpisać)/i
const CREATE_WORDS = /\b(utwórz|stwórz|przygotuj|napisz|wygeneruj|nowa umowa|na bazie|na podstawie|klient|kontrahent|dane\s)/i

/** Czy użytkownik chce utworzyć umowę, czy przeanalizować wklejoną / dodaną. */
export function detectIntent(prompt: string, attach: Attach | null): 'create' | 'analyze' {
  const words = prompt.trim().split(/\s+/).filter(Boolean).length
  if (attach?.kind === 'file') return prompt.trim() && CREATE_WORDS.test(prompt) && !ANALYZE_WORDS.test(prompt) ? 'create' : 'analyze'
  if (attach) return 'create'
  // „Przeanalizuj / sprawdź tę umowę …” albo wklejona treść umowy
  if (ANALYZE_WORDS.test(prompt) && !CREATE_WORDS.test(prompt.split(/\s+/).slice(0, 8).join(' '))) return 'analyze'
  if (words >= 120 || (words >= 50 && CONTRACT_MARKERS.test(prompt))) return CREATE_WORDS.test(prompt.split(/\s+/).slice(0, 12).join(' ')) ? 'create' : 'analyze'
  return 'create'
}

/** (+) przy polu „Stwórz umowę”: wybór wzoru lub dodanie pliku jako bazy umowy. */
function PlusMenu({ onPickTemplate, onFile, busy }: { onPickTemplate: () => void; onFile: (f: File) => void; busy: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
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
    <div className="relative shrink-0" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Dodaj wzór lub plik" className="grid size-10 place-items-center rounded-xl text-slate-600 ring-1 ring-inset ring-slate-300 transition hover:bg-slate-50 hover:text-ink-900">
        {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Plus className="size-5" aria-hidden />}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
      {open && (
        <div role="menu" className="animate-fade-up absolute left-0 top-full z-40 mt-1.5 w-64 rounded-2xl bg-white p-1.5 text-left shadow-xl ring-1 ring-slate-200">
          <button role="menuitem" type="button" onClick={() => { setOpen(false); onPickTemplate() }} className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50">
            <LayoutTemplate className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
            <span>
              <span className="block font-medium">Wybierz z wzorów</span>
              <span className="block text-xs text-slate-500">Twoje wzory i wzory Prawo.ai</span>
            </span>
          </button>
          <button role="menuitem" type="button" onClick={() => { setOpen(false); fileRef.current?.click() }} className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50">
            <Paperclip className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
            <span>
              <span className="block font-medium">Dodaj plik</span>
              <span className="block text-xs text-slate-500">Umowa PDF, DOCX lub TXT jako baza nowej</span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

/** Wybór wzoru: Twoje wzory albo biblioteka Prawo.ai. */
function TemplateChooser({ mine, onClose, onPick }: { mine: MyTemplate[]; onClose: () => void; onPick: (a: Attach) => void }) {
  const [tab, setTab] = useState<'mine' | 'lib'>(mine.length ? 'mine' : 'lib')
  const [q, setQ] = useState('')
  const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
  const lib = TEMPLATES.filter((t) => !q || norm(`${t.name} ${t.description}`).includes(norm(q)))
  const own = mine.filter((t) => !q || norm(t.name).includes(norm(q)))
  return (
    <Modal open onClose={onClose} size="lg" title="Wybierz wzór" description="Umowa powstanie na bazie wzoru – w opisie podaj strony i to, na czym Ci zależy.">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs<'mine' | 'lib'> label="Rodzaj wzorów" value={tab} onChange={setTab} tabs={[{ id: 'mine', label: `Twoje wzory (${mine.length})` }, { id: 'lib', label: 'Wzory Prawo.ai' }]} className="w-fit" />
        <label htmlFor="tpl-q" className="sr-only">
          Szukaj wzoru
        </label>
        <input id="tpl-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj, np. najem, NDA…" className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
      </div>
      <ul className="mt-3 max-h-[50vh] divide-y divide-slate-100 overflow-y-auto rounded-2xl ring-1 ring-slate-200">
        {tab === 'mine' ? (
          own.length ? (
            own.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => onPick({ kind: 'my', id: t.id })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                  <Bookmark className="size-4 shrink-0 text-brand-700" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink-900">{t.name}</span>
                    <span className="block text-xs text-slate-500">{t.clauses.length} zapisów</span>
                  </span>
                  <ChevronRight className="size-4 text-slate-400" aria-hidden />
                </button>
              </li>
            ))
          ) : (
            <li className="px-4 py-6 text-center text-sm text-slate-500">
              Nie masz jeszcze własnych wzorów.{' '}
              <Link to="/umowy#moje-wzory" className="font-medium text-brand-700 hover:underline">
                Dodaj swój wzór
              </Link>
            </li>
          )
        ) : (
          lib.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => onPick({ kind: 'lib', id: t.id })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                <FileText className="size-4 shrink-0 text-slate-500" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink-900">{t.name}</span>
                  <span className="block truncate text-xs text-slate-500">{t.description}</span>
                </span>
                <ChevronRight className="size-4 text-slate-400" aria-hidden />
              </button>
            </li>
          ))
        )}
      </ul>
    </Modal>
  )
}
