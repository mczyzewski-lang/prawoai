import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowRight, Bookmark, CalendarClock, Check, ChevronDown, ChevronRight, EyeOff, FilePlus2, FileSearch, FileText, FolderOpen, Handshake, Link2, Loader2, MessagesSquare, Sparkles, Upload } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { ButtonLink, EmptyState, StatusBadge } from '../components/ui'
import { displayStatus, formatDate, formatRelative, lastActivity, otherParty, plural } from '../lib/utils'
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
  const [myTpl, setMyTpl] = useState<string | null>(null)
  const myTemplates = state.myTemplates ?? []
  const selectedTpl = myTemplates.find((t) => t.id === myTpl)
  const { generate, overlay, busy, contacts } = useGenerate()
  // „Użyj wzoru” z Moich umów: /?wzor=<id>
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    const id = params.get('wzor')
    if (!id) return
    if (myTemplates.some((t) => t.id === id)) {
      setMyTpl(id)
      requestAnimationFrame(() => document.getElementById('home-prompt')?.focus())
    }
    setParams({}, { replace: true })
  }, [params, setParams, myTemplates])
  const start = (q: string, tplId: string | null = null) => {
    if (q.trim()) void generate(q, { myTemplateId: tplId })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {overlay}
      <section aria-label="Główne akcje">
        <p className="text-sm font-medium text-brand-700">Dzień dobry, {firstName}</p>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight text-ink-900 sm:text-3xl">Co chcesz dziś zrobić?</h1>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {/* Stwórz umowę */}
          <div className="relative flex flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 to-ink-800 p-5 text-white shadow-lg sm:p-6">
            <div className="pointer-events-none absolute -right-20 -top-20 size-60 rounded-full bg-brand-500/20 blur-3xl" aria-hidden />
            <div className="relative flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-brand-300" aria-hidden>
                <FilePlus2 className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Stwórz umowę</h2>
                <p className="text-sm text-white/70">Opisz ją własnymi słowami – dopytamy o szczegóły.</p>
              </div>
            </div>
            <form
              className="relative mt-4 flex-1 rounded-2xl bg-white p-2 shadow-xl"
              onSubmit={(e) => {
                e.preventDefault()
                start(prompt, myTpl)
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
                onSubmit={() => start(prompt, myTpl)}
                contacts={contacts}
                placeholder={selectedTpl ? `Wklej dane drugiej strony do wzoru „${selectedTpl.name}” albo wskaż ją przez @` : 'Np. Umowa zlecenia z Janem Kowalskim na obsługę stoiska 12–14 grudnia, 3000 zł. Zależy mi na płatności po wykonaniu.'}
                boxClassName="rounded-xl border-0 px-3 py-2.5 text-[16px] leading-6"
                inputClassName="text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <div className="flex min-w-0 items-center justify-end gap-2 px-1 pb-1">
                <MyTemplatePicker templates={myTemplates} value={myTpl} onChange={(id) => {
                  setMyTpl(id)
                  document.getElementById('home-prompt')?.focus()
                }} />
                <button type="submit" disabled={!prompt.trim() || busy} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40">
                  <Sparkles className="size-4" aria-hidden /> Generuj bezpłatnie
                </button>
              </div>
            </form>
            <div className="relative mt-4 flex flex-wrap gap-2">
              {QUICK_STARTS.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => {
                    setPrompt((cur) => (cur.trim() ? `${q.label}: ${cur.trim()}` : `${q.label}: `))
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

          {/* Przeanalizuj umowę */}
          <AnalyzeCard />
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

function AnalyzeCard() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'file' | 'paste'>('file')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const go = (t: string, fileName: string | null) => {
    try {
      sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ text: t, fileName }))
    } catch {
      /* ignoruj */
    }
    navigate('/analiza')
  }
  const handleFile = async (f: File) => {
    setError(null)
    setBusy(true)
    try {
      go(await extractText(f), f.name)
    } catch (e) {
      setError(e instanceof ExtractError ? e.message : 'Nie udało się odczytać pliku.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700" aria-hidden>
          <FileSearch className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Przeanalizuj umowę</h2>
          <p className="text-sm text-slate-600">Wskażemy ryzyka i podpowiemy, co zmienić.</p>
        </div>
      </div>
      <div role="tablist" aria-label="Sposób dodania umowy" className="mt-4 flex w-fit gap-1 rounded-xl bg-slate-100 p-1 text-sm">
        {(
          [
            ['file', 'Wgraj plik'],
            ['paste', 'Wklej tekst'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" type="button" aria-selected={mode === id} onClick={() => setMode(id)} className={`rounded-lg px-3 py-1.5 font-medium ${mode === id ? 'bg-white text-ink-900 shadow-sm' : 'text-slate-600'}`}>
            {label}
          </button>
        ))}
      </div>
      {mode === 'file' ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            const f = e.dataTransfer.files?.[0]
            if (f) void handleFile(f)
          }}
          className={`mt-3 flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${drag ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-sand-50/60'}`}
        >
          {busy ? (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="size-5 animate-spin text-brand-600" aria-hidden /> Odczytujemy plik…
            </p>
          ) : (
            <>
              <Upload className="size-7 text-brand-600" aria-hidden />
              <p className="mt-2 font-medium text-ink-900">Przeciągnij umowę tutaj</p>
              <p className="text-sm text-slate-500">PDF, DOCX lub TXT</p>
              <button type="button" onClick={() => inputRef.current?.click()} className="mt-3 rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">
                Wybierz plik
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                className="sr-only"
                aria-label="Wybierz plik umowy"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleFile(f)
                  e.target.value = ''
                }}
              />
            </>
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-1 flex-col">
          <label htmlFor="home-paste" className="sr-only">
            Treść umowy
          </label>
          <textarea id="home-paste" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Wklej pełną treść umowy…" className="w-full flex-1 resize-none rounded-2xl border border-slate-300 p-3 font-serif text-[15px] leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
          <div className="mt-2 flex justify-end">
            <button type="button" disabled={text.trim().split(/\s+/).length < 30} onClick={() => go(text, null)} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40">
              Analizuj <ArrowRight className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
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

/** Wybór własnego wzoru obok „Generuj bezpłatnie”. */
function MyTemplatePicker({ templates, value, onChange }: { templates: MyTemplate[]; value: string | null; onChange: (id: string | null) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = templates.find((t) => t.id === value)
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
    <div className="relative min-w-0 max-w-[13rem] shrink" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex h-10 w-full min-w-0 max-w-full items-center gap-1.5 rounded-xl px-3 text-sm font-medium ring-1 ring-inset transition ${selected ? 'bg-brand-50 text-brand-800 ring-brand-300' : 'text-slate-700 ring-slate-300 hover:bg-slate-50'}`}
      >
        <Bookmark className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{selected ? selected.name : 'Mój wzór'}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="animate-fade-up absolute right-0 top-full z-40 mt-1.5 w-72 rounded-2xl bg-white p-1.5 text-left shadow-xl ring-1 ring-slate-200">
          <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Twoje wzory</p>
          {templates.length === 0 ? (
            <p className="px-3 pb-2 text-sm text-slate-600">
              Nie masz jeszcze własnych wzorów. Otwórz umowę i wybierz „Zapisz jako mój wzór” albo dodaj go w{' '}
              <Link to="/umowy#moje-wzory" className="font-medium text-brand-700 hover:underline">
                Moich umowach
              </Link>
              .
            </p>
          ) : (
            <>
              <button role="menuitemradio" aria-checked={!value} type="button" onClick={() => { onChange(null); setOpen(false) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                <span className="grid size-4 place-items-center">{!value && <Check className="size-4 text-brand-600" aria-hidden />}</span>
                Bez wzoru – nowa umowa
              </button>
              {templates.map((t) => (
                <button key={t.id} role="menuitemradio" aria-checked={value === t.id} type="button" onClick={() => { onChange(t.id); setOpen(false) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50">
                  <span className="grid size-4 shrink-0 place-items-center">{value === t.id && <Check className="size-4 text-brand-600" aria-hidden />}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
                </button>
              ))}
              <Link to="/umowy#moje-wzory" className="mt-1 block border-t border-slate-100 px-3 pb-1 pt-2 text-xs font-medium text-brand-700 hover:underline">
                Zarządzaj wzorami
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}
