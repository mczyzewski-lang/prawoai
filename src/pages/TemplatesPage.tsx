import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Scale, Search, SearchX, Users, X } from 'lucide-react'
import { TemplateCover } from '../components/TemplateCover'
import { CATEGORIES, RELATION_LABELS, TEMPLATES, TARGET_LIBRARY_SIZE, getCategory, LIBRARY_REVIEWED, REVIEW_CLAIM, type CategoryId } from '../data/templates'
import type { PartyRelation } from '../types'
import { Badge, Button, EmptyState, PageHeader } from '../components/ui'
import { cx, plural } from '../lib/utils'

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
}

export default function TemplatesPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const cat = (params.get('kategoria') ?? '') as CategoryId | ''
  const rel = (params.get('strony') ?? '') as PartyRelation | ''

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const results = useMemo(() => {
    const terms = normalize(q).split(/\s+/).filter(Boolean)
    return TEMPLATES.filter((t) => {
      if (cat && t.category !== cat) return false
      if (rel && !t.relations.includes(rel)) return false
      if (!terms.length) return true
      const hay = normalize(`${t.name} ${t.description} ${t.roles.join(' ')} ${getCategory(t.category).name}`)
      return terms.every((term) => hay.includes(term))
    })
  }, [q, cat, rel])

  const countByCat = (id: CategoryId) => TEMPLATES.filter((t) => t.category === id && (!rel || t.relations.includes(rel))).length
  const hasFilters = q || cat || rel

  return (
    <div>
      <PageHeader
        eyebrow="Wzory umów"
        title="Wybierz wzór i stwórz umowę"
        description="Umowy dwustronne, w których warunki ustalacie razem z kontrahentem. Kreator przeprowadzi Cię przez najważniejsze decyzje."
      />
      {LIBRARY_REVIEWED && (
        <div className="-mt-2 mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200 sm:px-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700" aria-hidden>
            <Scale className="size-5" />
          </span>
          <p className="min-w-0 flex-1 text-sm text-slate-700">
            <span className="font-semibold text-ink-900">{REVIEW_CLAIM}.</span> Każdy wzór przygotowali i zweryfikowali prawnicy praktycy – możesz go dopasować do siebie, a w razie wątpliwości skonsultować umowę z kancelarią.
          </p>
          <span className="flex items-center gap-2 text-xs text-slate-500">
            we współpracy z
            <PravnaMark />
          </span>
        </div>
      )}

      <div className="sticky top-16 z-20 -mx-4 mb-5 space-y-3 bg-sand-50/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:px-0">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
          <label htmlFor="tpl-search" className="sr-only">
            Szukaj wzoru umowy
          </label>
          <input
            id="tpl-search"
            type="search"
            value={q}
            onChange={(e) => set('q', e.target.value)}
            placeholder="Szukaj, np. najem, NDA, freelancer, pożyczka…"
            className="h-12 w-full rounded-2xl border border-slate-300 bg-white pl-11 pr-4 text-[15px] shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="sr-only" id="rel-label">
            Typ stron
          </span>
          <div role="group" aria-labelledby="rel-label" className="flex flex-wrap gap-1.5">
            {(['', 'b2b', 'b2c', 'c2c'] as const).map((r) => (
              <button
                key={r || 'all'}
                type="button"
                aria-pressed={rel === r}
                onClick={() => set('strony', r)}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition',
                  rel === r ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-slate-700 ring-slate-300 hover:ring-slate-400',
                )}
              >
                {r === '' ? <Users className="size-3.5" aria-hidden /> : null}
                {r === '' ? 'Wszystkie strony' : RELATION_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside aria-label="Kategorie">
          <div className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
            <CatButton active={!cat} onClick={() => set('kategoria', '')} label="Wszystkie kategorie" count={TEMPLATES.filter((t) => !rel || t.relations.includes(rel)).length} />
            {CATEGORIES.map((c) => (
              <CatButton key={c.id} active={cat === c.id} onClick={() => set('kategoria', c.id)} label={c.name} short={c.short} count={countByCat(c.id)} />
            ))}
          </div>
          <p className="mt-4 hidden text-xs leading-relaxed text-slate-500 lg:block">
            Biblioteka jest rozbudowywana – docelowo znajdzie się w niej ok. {TARGET_LIBRARY_SIZE} wzorów przygotowanych i sprawdzonych przez prawników.
          </p>
        </aside>

        <section aria-live="polite" aria-label="Wyniki">
          <p className="mb-3 text-sm text-slate-600">
            {results.length} {plural(results.length, 'wzór', 'wzory', 'wzorów')}
            {cat ? ` · ${getCategory(cat).name}` : ''}
          </p>
          {results.length === 0 ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="Nie znaleźliśmy pasującego wzoru"
              action={
                hasFilters ? (
                  <Button variant="secondary" icon={<X className="size-4" />} onClick={() => setParams({}, { replace: true })}>
                    Wyczyść filtry
                  </Button>
                ) : undefined
              }
            >
              Spróbuj innego słowa lub zmień filtry. Możesz też opisać sytuację asystentowi AI – podpowie, jaka umowa będzie odpowiednia.
            </EmptyState>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((t) => (
                <li key={t.id}>
                  <Link to={`/wzory/${t.id}`} className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-xl hover:ring-brand-200">
                    <div className="relative bg-gradient-to-b from-sand-100 to-sand-50 px-6 pb-5 pt-6">
                      {/* Tagi nad okładką (nie nachodzą na nią); weryfikację PRAVNA.pl pokazuje sama okładka. */}
                      <div className="relative z-10 -mt-2 mb-2 flex h-6 gap-1">{t.popular && <Badge tone="brand">Popularny</Badge>}</div>
                      <TemplateCover t={t} size="sm" />
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">{getCategory(t.category).short}</p>
                      <h3 className="mt-1 font-serif text-[17px] font-semibold leading-snug text-ink-900">{t.name}</h3>
                      <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-600">{t.description}</p>
                      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
                        <Users className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                        {t.roles[0]} · {t.roles[1]}
                      </p>
                      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900 group-hover:text-brand-700">
                        Wykorzystaj wzór <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function CatButton({ active, onClick, label, short, count }: { active: boolean; onClick: () => void; label: string; short?: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'flex shrink-0 items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition lg:w-full',
        active ? 'bg-white font-semibold text-ink-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white/70 hover:text-ink-900',
      )}
    >
      <span>
        <span className="lg:hidden">{short ?? label}</span>
        <span className="hidden lg:inline">{label}</span>
      </span>
      <span className={cx('rounded-full px-1.5 text-xs', active ? 'bg-brand-100 text-brand-800' : 'bg-slate-200/70 text-slate-600')}>{count}</span>
    </button>
  )
}

/** Dyskretny znak słowny PRAVNA.pl (do podmiany na oficjalne logo). */
function PravnaMark() {
  return (
    <span className="inline-flex items-baseline rounded-md px-1.5 py-0.5 font-serif text-[15px] font-semibold tracking-[0.06em] text-ink-800 ring-1 ring-slate-200" aria-label="PRAVNA.pl">
      PRAVNA<span className="text-brand-600">.pl</span>
    </span>
  )
}
