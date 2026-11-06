import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BadgeCheck, Check, Clock, FileWarning, ListChecks, PenLine, Send, Sparkles, Users } from 'lucide-react'
import { getCategory, getTemplate, RELATION_LABELS, type TemplateDefinition } from '../data/templates'
import { DEFAULT_ANSWERS, generateClauses } from '../lib/contractGenerator'
import { useGenerate } from '../components/GenerateOverlay'
import { ButtonLink, EmptyState } from '../components/ui'
import { TemplateCover } from '../components/TemplateCover'
import type { Party } from '../types'

const WISHES: Record<string, string[]> = {
  b2b: ['Płatność po odbiorze', 'Krótki okres wypowiedzenia', 'Limit odpowiedzialności', 'Kary za opóźnienie'],
  freelance: ['Płatność w transzach', 'Prawa autorskie po zapłacie', 'Maks. 2 rundy poprawek', 'Termin odbioru 7 dni'],
  najem: ['Kaucja zwrotna w 14 dni', 'Możliwość wcześniejszego wypowiedzenia', 'Zgoda na zwierzę', 'Kto płaci za naprawy'],
  sprzedaz: ['Płatność przy odbiorze', 'Opis stanu technicznego', 'Odpowiedzialność za wady', 'Termin wydania'],
  rozliczenia: ['Spłata w ratach', 'Odsetki za opóźnienie', 'Wcześniejsza spłata bez kosztów', 'Zabezpieczenie spłaty'],
  ip: ['Długi okres poufności', 'Kara za ujawnienie', 'Zakres pól eksploatacji', 'Terytorium licencji'],
  wspolnicy: ['Równy podział decyzji', 'Zasady wyjścia wspólnika', 'Zakaz konkurencji', 'Podział zysków'],
}

function sectionTitles(t: TemplateDefinition): string[] {
  const p = (id: 'A' | 'B', i: 0 | 1): Party => ({ id, role: t.roles[i], kind: t.defaultKinds[i], name: '', idNumber: '', address: '', email: '', representative: '' })
  return generateClauses(t, [p('A', 0), p('B', 1)], { ...DEFAULT_ANSWERS, penalty: t.fields.includes('penalty') ? '10% wynagrodzenia za odstąpienie z winy strony' : DEFAULT_ANSWERS.penalty }).map((c) => c.title)
}

export default function TemplateDetailPage() {
  const { templateId } = useParams()
  const t = getTemplate(templateId)
  const [wish, setWish] = useState('')
  const { generate, overlay, busy } = useGenerate()

  if (!t) {
    return (
      <EmptyState icon={<FileWarning className="size-6" />} title="Nie znaleziono wzoru" action={<ButtonLink to="/wzory">Wróć do biblioteki</ButtonLink>}>
        Ten wzór mógł zostać usunięty albo link jest nieprawidłowy.
      </EmptyState>
    )
  }

  const approved = t.status === 'zatwierdzony' && t.review
  const sections = sectionTitles(t)
  const wishes = WISHES[t.category] ?? []

  const use = () => {
    const w = wish.trim()
    void generate(`Chcę utworzyć: ${t.name}.${w ? ` Zależy mi na: ${w}` : ''}`, { templateHint: t.id })
  }

  return (
    <div>
      {overlay}
      {/* Nagłówek wzoru */}
      <section className="-mx-4 -mt-6 bg-gradient-to-b from-sand-50 to-sand-100/60 px-4 pb-14 pt-8 sm:-mx-6 sm:px-6 md:-mt-8 md:pt-12">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <nav aria-label="Ścieżka" className="text-sm text-slate-500">
              <Link to="/wzory" className="hover:text-ink-900 hover:underline">
                Wzory umów
              </Link>{' '}
              / {t.name}
            </nav>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-700 ring-1 ring-slate-200">
                <ListChecks className="size-3.5" aria-hidden /> Wzór umowy · {getCategory(t.category).short}
              </span>
              {approved && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                  <BadgeCheck className="size-3.5" aria-hidden /> Potwierdzony przez {t.review!.reviewedBy}
                </span>
              )}
            </div>
            <h1 className="mt-5 font-serif text-[40px] font-semibold leading-[1.05] tracking-tight text-ink-900 sm:text-[56px]">{t.name}</h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-600">{t.description} Dostosujemy go do Twojej sytuacji – opisz, na czym Ci zależy, a resztę ustalimy w krótkiej rozmowie.</p>

            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
              <p className="flex items-center gap-2">
                <Users className="size-4 text-slate-400" aria-hidden /> {t.roles[0]} · {t.roles[1]}
              </p>
              <p className="flex items-center gap-2">
                <Clock className="size-4 text-slate-400" aria-hidden /> gotowa umowa w ok. 30 sekund
              </p>
            </div>

            {/* Czat: na czym Ci zależy */}
            <form
              className="mt-6 max-w-xl rounded-3xl bg-white p-2 shadow-xl ring-1 ring-slate-200"
              onSubmit={(e) => {
                e.preventDefault()
                use()
              }}
            >
              <div className="flex items-start gap-2 px-2 pt-2">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-ink-900 text-brand-300" aria-hidden>
                  <Sparkles className="size-3.5" />
                </span>
                <label htmlFor="wish" className="pt-1 text-sm font-medium text-ink-900">
                  Na czym Ci zależy w tej umowie?
                </label>
              </div>
              <textarea
                id="wish"
                rows={2}
                value={wish}
                onChange={(e) => setWish(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    use()
                  }
                }}
                placeholder="Np. płatność w dwóch transzach, prawa autorskie dopiero po zapłacie, maks. 2 rundy poprawek"
                className="w-full resize-none border-0 bg-transparent px-3 py-2 text-[15px] placeholder:text-slate-400 focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-1.5 px-2 pb-1">
                {wishes.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWish((cur) => (cur.trim() ? `${cur.trim().replace(/[,.]$/, '')}, ${w.toLowerCase()}` : w))}
                    className="rounded-full bg-sand-50 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-brand-50 hover:ring-brand-300"
                  >
                    + {w}
                  </button>
                ))}
              </div>
              <div className="flex justify-end px-1 pb-1 pt-2">
                <button type="submit" disabled={busy} className="inline-flex h-12 items-center gap-2 rounded-full bg-ink-900 px-6 text-[15px] font-semibold text-white shadow-[0_14px_30px_-12px_rgba(11,42,51,0.6)] transition hover:bg-ink-800 disabled:opacity-50">
                  <Sparkles className="size-4 text-brand-300" aria-hidden /> Generuj bezpłatnie
                </button>
              </div>
            </form>
            <p className="mt-3 text-sm text-slate-500">
              Wolisz formularz?{' '}
              <Link to={`/wzory/${t.id}/kreator`} className="font-medium text-brand-700 hover:underline">
                Wypełnij krok po kroku
              </Link>
            </p>
          </div>

          <div className="relative py-6">
            <div className="absolute inset-x-6 top-10 bottom-0 rounded-[3rem] bg-brand-200/30 blur-3xl" aria-hidden />
            <TemplateCover t={t} className="relative" />
          </div>
        </div>
      </section>

      {/* Co zawiera */}
      <section className="mx-auto mt-12 max-w-6xl">
        <h2 className="font-serif text-3xl font-semibold text-ink-900">Co zawiera wzór?</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {sections.map((title, i) => (
            <li key={title} className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 ring-1 ring-slate-200">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700" aria-hidden>
                <Check className="size-4" />
              </span>
              <span className="text-[15px] text-ink-900">
                <span className="mr-1.5 font-serif font-semibold text-brand-700">§ {i + 1}</span>
                {title}
              </span>
            </li>
          ))}
        </ul>

        <h2 className="mt-14 font-serif text-3xl font-semibold text-ink-900">Jak to działa?</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { icon: Sparkles, title: 'Powiedz, na czym Ci zależy', text: 'Asystent dopyta o strony, kwoty i terminy. Dane możesz po prostu wkleić.' },
            { icon: Send, title: 'Wyślij do drugiej strony', text: 'Kontrahent czyta umowę bez rejestracji i proponuje zmiany do akceptacji.' },
            { icon: PenLine, title: 'Podpiszcie na ekranie', text: 'Palcem na telefonie albo kodem SMS na komputerze. PDF gotowy od razu.' },
          ].map((s, i) => (
            <li key={s.title} className="rounded-3xl bg-white p-6 ring-1 ring-slate-200">
              <span className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-ink-900 text-brand-300" aria-hidden>
                  <s.icon className="size-5" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Krok {i + 1}</span>
              </span>
              <p className="mt-4 font-semibold text-ink-900">{s.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex flex-col items-start gap-4 rounded-3xl bg-ink-900 p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="font-serif text-2xl font-semibold">Gotowy, żeby zacząć?</p>
            <p className="mt-1 text-sm text-white/70">
              Dla relacji: {t.relations.map((r) => RELATION_LABELS[r]).join(', ')}.{' '}
              {approved ? `Wzór stworzony i potwierdzony przez ${t.review!.reviewedBy}.` : 'Wzór przykładowy – przed podpisaniem warto, by umowę sprawdził prawnik.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' })
              setTimeout(() => document.getElementById('wish')?.focus(), 400)
            }}
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-brand-500 px-6 font-semibold text-ink-950 transition hover:bg-brand-400"
          >
            <Sparkles className="size-4" aria-hidden /> Generuj bezpłatnie
          </button>
        </div>
      </section>
    </div>
  )
}
