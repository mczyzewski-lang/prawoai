import { ArrowRightLeft, CheckCircle2, CircleDashed, Loader2, Sparkles } from 'lucide-react'
import { PageHeader } from '../components/ui'
import { DIFFERENCES, MARKET, MARKET_SUMMARY, MOATS, type BacklogStatus } from '../data/backlog'
import { cx } from '../lib/utils'

const STATUS: Record<BacklogStatus, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  gotowe: { label: 'Gotowe', cls: 'bg-brand-50 text-brand-800 ring-brand-200', icon: CheckCircle2 },
  'w toku': { label: 'W toku', cls: 'bg-amber-50 text-amber-800 ring-amber-200', icon: Loader2 },
  backlog: { label: 'Backlog', cls: 'bg-slate-100 text-slate-700 ring-slate-200', icon: CircleDashed },
}

/** „Inne” – założenia produktu i backlog („fosy” w czasach AI). */
export default function OtherPage() {
  const all = MOATS.flatMap((m) => m.items)
  const done = all.filter((i) => i.status === 'gotowe').length
  return (
    <div>
      <PageHeader
        eyebrow="Inne"
        title="Założenia i backlog"
        description={`Na czym budujemy przewagę Prawo.ai – „fosy” w czasach AI. Przy każdej: teza, zasada Prawo.ai, sposób realizacji i lista zadań. Zrobione ${done} z ${all.length}.`}
      />
      <ol className="space-y-5">
        {MOATS.map((m) => (
          <li key={m.n} className="overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200">
            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">Fosa {m.n}/8</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">{m.title}</h2>
                <p className="mt-2 text-[15px] text-slate-700">{m.thesis}</p>
                <p className="mt-3 border-l-4 border-amber-400 pl-3 text-sm text-slate-700">
                  <span className="font-semibold text-ink-900">Sprawdź: </span>
                  {m.check}
                </p>
                <div className="mt-4 rounded-2xl bg-brand-50/60 p-4 ring-1 ring-brand-100">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">Jak to realizujemy</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-800">{m.ours}</p>
                </div>
              </div>
              {/* Ciemny boks – zasada Prawo.ai */}
              <div className="self-start overflow-hidden rounded-2xl bg-ink-900 text-white shadow-sm">
                <p className="flex items-center gap-2 border-b border-white/10 bg-black/20 px-4 py-2.5 text-sm font-semibold">
                  <span className="flex gap-1" aria-hidden>
                    <span className="size-2.5 rounded-full bg-amber-400" />
                    <span className="size-2.5 rounded-full bg-white/30" />
                    <span className="size-2.5 rounded-full bg-white/30" />
                  </span>
                  Przykład · Prawo.ai
                </p>
                <p className="px-4 py-3.5 text-sm leading-relaxed text-white/90">{m.principle}</p>
              </div>
            </div>
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {m.items.map((it) => {
                const st = STATUS[it.status]
                return (
                  <li key={it.title} className="flex items-start gap-3 px-5 py-3 sm:px-6">
                    <span className={cx('mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', st.cls)}>
                      <st.icon className="size-3" aria-hidden /> {st.label}
                    </span>
                    <span className="min-w-0 text-sm">
                      <span className="font-medium text-ink-900">{it.title}</span>
                      <span className="block text-slate-600">{it.detail}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ol>

      <section className="mt-10" aria-labelledby="market-h">
        <h2 id="market-h" className="flex items-center gap-2 text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">
          <ArrowRightLeft className="size-5 text-brand-700" aria-hidden /> Rynek: konkurencja a Prawo.ai
        </h2>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-slate-700">{MARKET_SUMMARY}</p>

        <div className="mt-5 overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200">
          <div className="hidden grid-cols-[11rem_minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b border-slate-200 bg-sand-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid">
            <span>Obszar</span>
            <span>Konkurencja</span>
            <span>Prawo.ai</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {MARKET.map((r) => {
              const st = STATUS[r.status]
              return (
                <li key={r.area} className="grid gap-2 px-5 py-4 lg:grid-cols-[11rem_minmax(0,1fr)_minmax(0,1fr)] lg:gap-4">
                  <p className="font-semibold text-ink-900">{r.area}</p>
                  <div className="text-sm text-slate-600">
                    <span className="font-medium text-slate-500 lg:hidden">Konkurencja: </span>
                    {r.theirs}
                  </div>
                  <div className="text-sm text-slate-800">
                    <span className="font-medium text-slate-500 lg:hidden">Prawo.ai: </span>
                    {r.ours}
                    <span className={cx('ml-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 align-middle text-[11px] font-semibold ring-1 ring-inset', st.cls)}>
                      <st.icon className="size-3" aria-hidden /> {st.label}
                    </span>
                    {r.todo && (
                      <p className="mt-1.5 rounded-lg bg-sand-50 px-2.5 py-1.5 text-[13px] text-slate-700 ring-1 ring-slate-200">
                        <span className="font-semibold text-ink-900">Backlog: </span>
                        {r.todo}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        <h3 className="mt-8 text-lg font-semibold text-ink-900">Czym różni się Prawo.ai</h3>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DIFFERENCES.map((d, i) => (
            <li key={d.title} className={cx('rounded-2xl p-4 ring-1', i === DIFFERENCES.length - 1 ? 'bg-amber-50 ring-amber-200' : 'bg-white ring-slate-200')}>
              <p className="flex items-start gap-2 font-semibold text-ink-900">
                <Sparkles className={cx('mt-0.5 size-4 shrink-0', i === DIFFERENCES.length - 1 ? 'text-amber-600' : 'text-brand-600')} aria-hidden />
                {d.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{d.detail}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
