import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowRight, ArrowUp, ChevronRight, EyeOff, FileSearch, FileText, FolderOpen, Handshake, Link2, MessagesSquare, Sparkles } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { ButtonLink, EmptyState, StatusBadge } from '../components/ui'
import { displayStatus, formatRelative, lastActivity, otherParty, plural } from '../lib/utils'
import { QUICK_STARTS } from '../lib/intake'
import type { Contract } from '../types'

export default function HomePage() {
  const { state } = useStore()
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')
  const contracts = [...state.contracts].sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)))
  const awaiting = contracts.filter((c) => displayStatus(c, c.ownerPartyId) === 'awaiting')
  const firstName = state.profile.name.split(' ')[0]
  const start = (q: string) => q.trim() && navigate(`/nowa?q=${encodeURIComponent(q.trim())}`)

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* 1. Stwórz umowę – główne pole */}
      <section aria-labelledby="create" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-ink-900 to-ink-800 px-5 py-7 text-white shadow-lg sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/20 blur-3xl" aria-hidden />
        <p className="relative text-sm font-medium text-brand-300">Dzień dobry, {firstName}</p>
        <h1 id="create" className="relative mt-1 text-[28px] font-semibold leading-tight tracking-tight sm:text-4xl">
          Stwórz umowę
        </h1>
        <p className="relative mt-2 max-w-xl text-[15px] leading-relaxed text-white/75">Opisz własnymi słowami, czego dotyczy i z kim ją zawierasz. Dopytamy o brakujące dane i przygotujemy projekt do wysłania drugiej stronie.</p>

        <form
          className="relative mt-6 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-white/10"
          onSubmit={(e) => {
            e.preventDefault()
            start(prompt)
          }}
        >
          <label htmlFor="home-prompt" className="sr-only">
            Opisz umowę, którą chcesz przygotować
          </label>
          <textarea
            id="home-prompt"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                start(prompt)
              }
            }}
            placeholder="Np. Umowa zlecenia z Janem Kowalskim na obsługę stoiska 12–14 grudnia, 3000 zł"
            className="w-full resize-none rounded-xl border-0 bg-transparent px-3 py-2.5 text-[16px] sm:h-[4.5rem] text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="flex items-center gap-1.5 pl-2 text-xs text-slate-500">
              <Sparkles className="size-3.5 text-brand-600" aria-hidden /> Asystent rozpozna rodzaj umowy i dane stron
            </span>
            <button type="submit" disabled={!prompt.trim()} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40">
              Utwórz <ArrowUp className="size-4" aria-hidden />
            </button>
          </div>
        </form>

        <div className="relative mt-4 flex flex-wrap gap-2">
          {QUICK_STARTS.map((q) => (
            <button key={q.label} type="button" onClick={() => start(q.prompt)} className="rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/20">
              {q.label}
            </button>
          ))}
          <Link to="/wzory" className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-brand-200 hover:text-white">
            Wszystkie wzory <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </section>

      {/* 2. Pozostałe akcje */}
      <section aria-label="Inne akcje" className="grid gap-3 sm:grid-cols-2">
        <ActionCard to="/analiza" icon={FileSearch} title="Przeanalizuj umowę" text="Wgraj PDF lub DOCX – wskażemy, co jest dla Ciebie ryzykowne i co zmienić." />
        <ActionCard to="/asystent" icon={MessagesSquare} title="Zapytaj asystenta AI" text="Opisz sprawę prawną. Pomożemy ustalić kolejne kroki i potrzebne dokumenty." />
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
                <Link to={`/umowy/${c.id}?panel=negocjacje`} className="group flex items-center gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-amber-200/70 transition hover:ring-amber-400">
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

function ActionCard({ to, icon: Icon, title, text }: { to: string; icon: typeof FileSearch; title: string; text: string }) {
  return (
    <Link to={to} className="group flex items-center gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 transition hover:shadow-md hover:ring-brand-300">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700" aria-hidden>
        <Icon className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink-900">{title}</span>
        <span className="mt-0.5 block text-sm leading-relaxed text-slate-600">{text}</span>
      </span>
      <ArrowRight className="size-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600" aria-hidden />
    </Link>
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
