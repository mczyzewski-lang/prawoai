import { CheckCircle2, CircleDashed, Loader2 } from 'lucide-react'
import { PageHeader } from '../components/ui'
import { MOATS, type BacklogStatus } from '../data/backlog'
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
    </div>
  )
}
