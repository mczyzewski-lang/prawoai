import { useState } from 'react'
import { BadgeCheck, Check, Clock, Gavel, Scale, Zap } from 'lucide-react'
import type { Contract, LawyerReview } from '../types'
import { useStore } from '../store/AppStore'
import { Alert, Button, Modal, TextArea, TextField } from './ui'
import { useToast } from './Toast'
import { EXPRESS_MULTIPLIER, REVIEW_ORDER_EMAIL, REVIEW_PACKAGES, REVIEWER_NAME, VAT } from '../data/lawyerReview'
import { cx, formatDateTime, nowIso, uid } from '../lib/utils'

const zl = (n: number) => `${n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} zł`

/** Liczba stron umowy (≈ 350 słów na stronę). */
export function contractPages(c: Contract): number {
  const words = c.clauses.reduce((n, cl) => n + cl.text.split(/\s+/).filter(Boolean).length, 0)
  return Math.max(1, Math.round(words / 350))
}

/** Termin wyniku: dni robocze (do 17:00) albo 4 godziny robocze w trybie ekspres. */
function dueDate(days: number, express: boolean): Date {
  const d = new Date()
  const addWorkHours = (h: number) => {
    let left = h
    while (left > 0) {
      d.setHours(d.getHours() + 1)
      const wd = d.getDay()
      if (wd !== 0 && wd !== 6 && d.getHours() >= 9 && d.getHours() <= 17) left--
    }
  }
  if (express) addWorkHours(4)
  else {
    let left = days
    while (left > 0) {
      d.setDate(d.getDate() + 1)
      if (d.getDay() !== 0 && d.getDay() !== 6) left--
    }
    d.setHours(17, 0, 0, 0)
  }
  return d
}

/** Karta zachęty w panelu uwag / pod analizą. */
export function LawyerReviewCard({ c, onOrder }: { c: Contract; onOrder: () => void }) {
  if (c.lawyerReview) return <LawyerReviewStatus r={c.lawyerReview} />
  const cheapest = Math.min(...REVIEW_PACKAGES.map((p) => p.priceNet))
  return (
    <div className="rounded-2xl bg-ink-900 p-4 text-white">
      <p className="flex items-center gap-2 font-semibold">
        <Scale className="size-4 text-brand-300" aria-hidden /> Pewność przed podpisem
      </p>
      <p className="mt-1 text-sm text-white/80">Prawnik PRAVNA.pl sprawdzi tę umowę i uwagi AI, poprawi treść i odpowie na Twoje pytania.</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-white/70">
          od <span className="font-semibold text-white">{zl(cheapest)}</span> netto · wynik w 1 dzień roboczy
        </span>
        <Button size="sm" variant="accent" icon={<Gavel className="size-4" />} onClick={onOrder}>
          Zamów weryfikację
        </Button>
      </div>
    </div>
  )
}

export function LawyerReviewStatus({ r, compact }: { r: LawyerReview; compact?: boolean }) {
  const done = r.status === 'gotowa'
  if (compact)
    return (
      <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', done ? 'bg-brand-50 text-brand-800 ring-brand-200' : 'bg-violet-50 text-violet-800 ring-violet-200')}>
        {done ? <BadgeCheck className="size-3.5" aria-hidden /> : <Clock className="size-3.5" aria-hidden />}
        {done ? 'Zweryfikowane przez prawnika' : `U prawnika · do ${formatDateTime(r.dueAt)}`}
      </span>
    )
  return (
    <div className={cx('rounded-2xl p-4 ring-1', done ? 'bg-brand-50 ring-brand-200' : 'bg-violet-50 ring-violet-200')}>
      <p className="flex items-center gap-2 font-semibold text-ink-900">
        {done ? <BadgeCheck className="size-4 text-brand-700" aria-hidden /> : <Clock className="size-4 text-violet-700" aria-hidden />}
        {done ? 'Umowa zweryfikowana przez prawnika' : 'Umowa w weryfikacji u prawnika'}
      </p>
      <p className="mt-1 text-sm text-slate-700">
        {r.packageName}
        {r.express ? ' · ekspres' : ''} · wynik do {formatDateTime(r.dueAt)}
      </p>
      <ol className="mt-3 flex items-center gap-2 text-xs">
        {(['zamówiona', 'w weryfikacji', 'gotowa'] as const).map((s, i, all) => {
          const reached = all.indexOf(r.status) >= i
          return (
            <li key={s} className="flex flex-1 items-center gap-2">
              <span className={cx('grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold', reached ? 'bg-ink-900 text-white' : 'bg-white text-slate-400 ring-1 ring-slate-300')}>{reached ? <Check className="size-3" aria-hidden /> : i + 1}</span>
              <span className={cx('capitalize', reached ? 'font-medium text-ink-900' : 'text-slate-500')}>{s}</span>
              {i < all.length - 1 && <span className="h-px flex-1 bg-slate-300" />}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Zamówienie weryfikacji: zakres → kontekst → podsumowanie. */
export function LawyerReviewDialog({ c, open, onClose }: { c: Contract; open: boolean; onClose: () => void }) {
  const { state, updateContract } = useStore()
  const toast = useToast()
  const pages = contractPages(c)
  const recommended = c.analysis ? (REVIEW_PACKAGES.find((p) => p.id === 'pelna') ?? REVIEW_PACKAGES[0]) : REVIEW_PACKAGES[1]
  const [step, setStep] = useState(0)
  const [pkgId, setPkgId] = useState(recommended.id)
  const [express, setExpress] = useState(false)
  const [note, setNote] = useState(() => (c.analysis?.priorities?.length ? `Zależy mi szczególnie na:\n${c.analysis.priorities.map((p) => `• ${p}`).join('\n')}\n\nPytania do prawnika:\n` : 'Na czym mi zależy i co budzi moje wątpliwości:\n'))
  const [email, setEmail] = useState(state.profile.email ?? '')
  const pkg = REVIEW_PACKAGES.find((p) => p.id === pkgId)!
  const net = Math.round(pkg.priceNet * (express ? EXPRESS_MULTIPLIER : 1))
  const gross = Math.round(net * (1 + VAT) * 100) / 100
  const due = dueDate(pkg.days, express)
  const tooLong = pages > pkg.maxPages
  const demo = !REVIEW_ORDER_EMAIL

  const order = () => {
    const review: LawyerReview = { id: uid('lr'), packageId: pkg.id, packageName: pkg.name, priceNet: net, express, note: note.trim(), contactEmail: email.trim(), orderedAt: nowIso(), dueAt: due.toISOString(), status: 'zamówiona' }
    updateContract(c.id, (x) => ({ ...x, lawyerReview: review, activity: [...x.activity, { id: uid('a'), at: nowIso(), text: `${state.profile.name} zamówił(a) weryfikację u prawnika: ${pkg.name}`, partyId: x.ownerPartyId }] }))
    if (!demo) {
      const body = `Zamówienie weryfikacji umowy\n\nUmowa: ${c.title}\nPakiet: ${pkg.name}${express ? ' (ekspres)' : ''}\nCena: ${zl(net)} netto\nTermin: ${formatDateTime(due.toISOString())}\nKontakt: ${email}\n\n${note}`
      window.location.href = `mailto:${REVIEW_ORDER_EMAIL}?subject=${encodeURIComponent(`Weryfikacja umowy: ${c.title}`)}&body=${encodeURIComponent(body)}`
    }
    toast('Zamówienie przyjęte – prawnik potwierdzi je e-mailem')
    onClose()
    setStep(0)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Weryfikacja umowy przez prawnika"
      description={`Krok ${step + 1} z 3 · ${['Zakres', 'Kontekst dla prawnika', 'Podsumowanie'][step]}`}
      footer={
        <>
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep(step - 1)}>
              Wstecz
            </Button>
          )}
          {step < 2 ? (
            <Button variant="primary" onClick={() => setStep(step + 1)} disabled={step === 1 && !/^\S+@\S+\.\S+$/.test(email.trim())}>
              Dalej
            </Button>
          ) : (
            <Button variant="accent" icon={<Gavel className="size-4" />} onClick={order}>
              {demo ? 'Zamów (wersja demonstracyjna)' : `Zamawiam za ${zl(gross)} brutto`}
            </Button>
          )}
        </>
      }
    >
      {step === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Umowa „{c.title}” ma ok. {pages} {pages === 1 ? 'stronę' : pages < 5 ? 'strony' : 'stron'}. Weryfikację wykonuje {REVIEWER_NAME}.
          </p>
          <div role="radiogroup" aria-label="Pakiet" className="grid gap-3 sm:grid-cols-3">
            {REVIEW_PACKAGES.map((p) => {
              const on = p.id === pkgId
              return (
                <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => setPkgId(p.id)} className={cx('relative flex flex-col rounded-2xl p-4 text-left ring-1 transition', on ? 'bg-brand-50/60 ring-2 ring-brand-500' : 'bg-white ring-slate-200 hover:ring-slate-300')}>
                  {p.id === recommended.id && <span className="absolute -top-2 right-3 rounded-full bg-ink-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Polecany</span>}
                  <span className="font-semibold text-ink-900">{p.name}</span>
                  <span className="mt-1 text-xl font-semibold text-ink-900">
                    {zl(p.priceNet)} <span className="text-xs font-normal text-slate-500">netto</span>
                  </span>
                  <span className="text-xs text-slate-500">
                    do {p.maxPages} stron · {p.days} {p.days === 1 ? 'dzień roboczy' : 'dni robocze'}
                  </span>
                  <ul className="mt-2 space-y-1 text-xs text-slate-700">
                    {p.includes.map((x) => (
                      <li key={x} className="flex gap-1.5">
                        <Check className="mt-0.5 size-3 shrink-0 text-brand-600" aria-hidden />
                        {x}
                      </li>
                    ))}
                  </ul>
                </button>
              )
            })}
          </div>
          {tooLong && <Alert tone="warning">Umowa jest dłuższa niż {pkg.maxPages} stron – prawnik potwierdzi indywidualną wycenę przed rozpoczęciem pracy.</Alert>}
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
            <span className="flex items-center gap-2 text-sm">
              <Zap className="size-4 text-amber-600" aria-hidden />
              <span>
                <span className="font-semibold text-ink-900">Ekspres</span> – wynik w 4 godziny robocze (+{Math.round((EXPRESS_MULTIPLIER - 1) * 100)}%)
              </span>
            </span>
            <input type="checkbox" checked={express} onChange={(e) => setExpress(e.target.checked)} className="size-5 accent-brand-600" />
          </label>
        </div>
      )}
      {step === 1 && (
        <div className="space-y-3">
          <TextArea label="Na czym Ci zależy, co budzi wątpliwości" rows={7} value={note} onChange={(e) => setNote(e.target.value)} />
          <TextField label="E-mail do kontaktu z prawnikiem" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <ul className="space-y-1.5 rounded-xl bg-sand-50 p-3 text-sm text-slate-700">
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /> Prawnik dostanie aktualną wersję umowy{c.analysis ? ', uwagi AI i Twoje decyzje' : ''}{c.proposals.length ? ' oraz historię negocjacji' : ''}.
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /> Rozmowy z asystentem pozostają prywatne – nie są przekazywane.
            </li>
          </ul>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <dl className="divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-200">
            {[
              ['Umowa', c.title],
              ['Zakres', `${pkg.name}${express ? ' · ekspres' : ''}`],
              ['Kto', REVIEWER_NAME],
              ['Wynik do', formatDateTime(due.toISOString())],
              ['Cena', `${zl(net)} netto · ${zl(gross)} brutto`],
              ['Kontakt', email],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[7rem_1fr] gap-3 px-4 py-2.5 text-sm">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium text-ink-900">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-slate-500">Cena jest stała – jeśli zakres miałby się zmienić, najpierw dostaniesz nową wycenę do akceptacji. Wynik: poprawiona umowa, komentarze prawnika i znak „Zweryfikowane przez prawnika”.</p>
          {demo && (
            <Alert tone="info" title="Wersja demonstracyjna">
              Płatności i przekazywanie zamówień do prawników uruchomimy po podłączeniu serwera. Teraz zamówienie zapisze się tylko w tej umowie.
            </Alert>
          )}
        </div>
      )}
    </Modal>
  )
}
