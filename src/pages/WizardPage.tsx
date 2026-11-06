import { AddressFields } from '../components/OwnDataModal'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Building2, Check, ChevronDown, FileWarning, Lightbulb, RotateCcw, Save, Send, User } from 'lucide-react'
import { getCategory, getTemplate, type FieldKey, type TemplateDefinition } from '../data/templates'
import type { Clause, Contract, Party, PartyId } from '../types'
import {
  DEFAULT_ANSWERS,
  IP_OPTIONS,
  LIABILITY_OPTIONS,
  NOTICE_OPTIONS,
  PENALTY_OPTIONS,
  generateClauses,
  labelFor,
  type WizardAnswers,
} from '../lib/contractGenerator'
import { useStore } from '../store/AppStore'
import { Alert, Button, ButtonLink, Card, EmptyState, SelectField, TextArea, TextField } from '../components/ui'
import { ShareDialog } from '../components/ShareDialog'
import { PartiesColumns } from '../components/workspace/DocumentParts'
import { useToast } from '../components/Toast'
import { cx, nowIso, otherParty, uid } from '../lib/utils'

const STEPS = ['Twoja rola', 'Strony', 'Warunki', 'Projekt', 'Wyślij']

interface Draft {
  step: number
  myRole: PartyId | null
  parties: [Party, Party]
  answers: WizardAnswers
  clauses: Clause[] | null
  title: string
}

function emptyParty(id: PartyId, t: TemplateDefinition): Party {
  const i = id === 'A' ? 0 : 1
  return { id, role: t.roles[i], kind: t.defaultKinds[i], name: '', idNumber: '', address: '', email: '', representative: '' }
}

const draftKey = (id: string) => `prawoai:wizard:${id}`

export default function WizardPage() {
  const { templateId } = useParams()
  const t = getTemplate(templateId)
  if (!t) {
    return (
      <EmptyState icon={<FileWarning className="size-6" />} title="Nie znaleziono wzoru" action={<ButtonLink to="/wzory">Wróć do biblioteki</ButtonLink>}>
        Ten wzór mógł zostać usunięty lub link jest nieprawidłowy.
      </EmptyState>
    )
  }
  return <Wizard t={t} key={t.id} />
}

function Wizard({ t }: { t: TemplateDefinition }) {
  const { state, upsertContract, updateProfile } = useStore()
  const [rememberOwn, setRememberOwn] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const raw = localStorage.getItem(draftKey(t.id))
      if (raw) return JSON.parse(raw) as Draft
    } catch {
      /* brak zapisanego postępu */
    }
    return { step: 0, myRole: null, parties: [emptyParty('A', t), emptyParty('B', t)], answers: { ...DEFAULT_ANSWERS }, clauses: null, title: t.name }
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [created, setCreated] = useState<Contract | null>(null)
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(draftKey(t.id), JSON.stringify(draft))
    } catch {
      /* ignoruj */
    }
  }, [draft, t.id])

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))
  const setAnswer = <K extends keyof WizardAnswers>(k: K, v: WizardAnswers[K]) => setDraft((d) => ({ ...d, answers: { ...d.answers, [k]: v }, clauses: null }))
  const setParty = (id: PartyId, p: Partial<Party>) =>
    setDraft((d) => ({ ...d, clauses: null, parties: d.parties.map((x) => (x.id === id ? { ...x, ...p } : x)) as [Party, Party] }))

  const generated = useMemo(() => generateClauses(t, draft.parties, draft.answers), [t, draft.parties, draft.answers])
  const clauses = draft.clauses ?? generated

  const validate = (step: number): boolean => {
    const e: Record<string, string> = {}
    if (step === 0 && !draft.myRole) e.role = 'Wybierz, którą stroną umowy jesteś.'
    if (step === 1) {
      draft.parties.forEach((p) => {
        if (!p.name.trim()) e[`${p.id}.name`] = p.kind === 'firma' ? 'Podaj nazwę firmy.' : 'Podaj imię i nazwisko.'
        if (p.email && !/^\S+@\S+\.\S+$/.test(p.email)) e[`${p.id}.email`] = 'Nieprawidłowy adres e-mail.'
      })
    }
    if (step === 2) {
      if (!draft.answers.scope.trim()) e.scope = 'Opisz przedmiot umowy – to najważniejszy zapis.'
      if (t.fields.includes('amount') && draft.answers.amount && !(Number(draft.answers.amount.replace(',', '.')) > 0)) e.amount = 'Podaj kwotę większą od zera.'
      if (draft.answers.startDate && draft.answers.endDate && draft.answers.endDate < draft.answers.startDate) e.endDate = 'Termin zakończenia nie może być wcześniejszy niż data rozpoczęcia.'
    }
    if (step === 3 && clauses.some((c) => !c.text.trim())) e.clauses = 'Każdy zapis musi mieć treść. Usuń pusty zapis lub go uzupełnij.'
    setErrors(e)
    if (Object.keys(e).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"], [data-error]')?.focus())
    }
    return Object.keys(e).length === 0
  }

  const go = (step: number) => {
    if (step > draft.step && !validate(draft.step)) return
    if (draft.step === 1 && step > 1 && rememberOwn) {
      const own = draft.parties.find((p) => p.id === draft.myRole)
      if (own) {
        updateProfile({ ...state.profile, ownParty: { kind: own.kind, name: own.name, address: own.address, idNumber: own.idNumber, email: own.email, representative: own.representative } })
        toast('Zapisano Twoje dane – uzupełnimy je automatycznie w kolejnych umowach')
      }
      setRememberOwn(false)
    }
    patch({ step })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const buildContract = (): Contract => {
    const at = nowIso()
    const finalClauses = clauses.map((c) => ({ ...c }))
    return {
      id: uid('k'),
      title: draft.title.trim() || t.name,
      templateId: t.id,
      source: 'template',
      createdAt: at,
      updatedAt: at,
      stage: 'draft',
      ownerPartyId: draft.myRole ?? 'A',
      parties: draft.parties,
      clauses: finalClauses,
      proposals: [],
      comments: [],
      versions: [{ id: uid('v'), number: 1, createdAt: at, authorName: state.profile.name, note: 'Utworzono projekt z kreatora', clauses: finalClauses.map((c) => ({ ...c })) }],
      signatures: [],
      acceptedBy: {},
      privateChats: {},
      activity: [{ id: uid('a'), at, text: `${state.profile.name} utworzył(a) projekt umowy`, partyId: draft.myRole ?? 'A' }],
    }
  }

  const finish = (send: boolean) => {
    const c = created ?? buildContract()
    if (!created) {
      upsertContract(c)
      setCreated(c)
      localStorage.removeItem(draftKey(t.id))
    }
    if (send) setShareOpen(true)
    else {
      toast('Projekt zapisany w „Moich umowach”')
      navigate(`/umowy/${c.id}`)
    }
  }

  const resetAll = () => {
    localStorage.removeItem(draftKey(t.id))
    setDraft({ step: 0, myRole: null, parties: [emptyParty('A', t), emptyParty('B', t)], answers: { ...DEFAULT_ANSWERS }, clauses: null, title: t.name })
    setErrors({})
  }

  const liveContract = created ? state.contracts.find((c) => c.id === created.id) ?? created : null

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/wzory" className="mb-4 inline-flex items-center gap-1 rounded-lg text-sm font-medium text-slate-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Wzory umów
      </Link>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">{getCategory(t.category).name}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">{t.name}</h1>
        </div>
        {draft.step > 0 && !created && (
          <Button variant="ghost" size="sm" onClick={resetAll} icon={<RotateCcw className="size-4" />}>
            <span className="hidden sm:inline">Zacznij od nowa</span>
          </Button>
        )}
      </div>

      {/* Postęp */}
      <ol className="mb-6 grid grid-cols-5 gap-1.5" aria-label="Kroki kreatora">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              disabled={i > draft.step || !!created}
              onClick={() => go(i)}
              aria-current={i === draft.step ? 'step' : undefined}
              className="group w-full text-left disabled:cursor-default"
            >
              <span className={cx('block h-1.5 rounded-full transition', i <= draft.step ? 'bg-brand-500' : 'bg-slate-200')} />
              <span className={cx('mt-1.5 hidden text-xs font-medium sm:block', i === draft.step ? 'text-ink-900' : 'text-slate-500')}>
                {i + 1}. {s}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mb-4 text-sm font-medium text-slate-700 sm:hidden">
        Krok {draft.step + 1} z {STEPS.length}: {STEPS[draft.step]}
      </p>

      {draft.step === 0 && (
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-ink-900">Którą stroną umowy jesteś?</h2>
          <p className="mt-1 text-sm text-slate-600">Dzięki temu dopasujemy wyjaśnienia i wskażemy, co jest ważne z Twojej perspektywy. Projekt pozostanie wyważony dla obu stron.</p>
          <div role="radiogroup" aria-label="Twoja rola" className="mt-5 grid gap-3 sm:grid-cols-2" data-error={errors.role ? true : undefined} tabIndex={-1}>
            {(['A', 'B'] as PartyId[]).map((id, i) => {
              const selected = draft.myRole === id
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    patch({ myRole: id })
                    setErrors({})
                  }}
                  className={cx('flex items-center gap-3 rounded-2xl p-4 text-left ring-2 transition', selected ? 'bg-brand-50 ring-brand-500' : 'bg-white ring-slate-200 hover:ring-slate-300')}
                >
                  <span className={cx('grid size-6 shrink-0 place-items-center rounded-full border-2', selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300')}>{selected && <Check className="size-3.5" aria-hidden />}</span>
                  <span>
                    <span className="block font-semibold text-ink-900">{t.roles[i]}</span>
                    <span className="mt-0.5 block text-sm text-slate-600">Druga strona: {t.roles[1 - i]}</span>
                  </span>
                </button>
              )
            })}
          </div>
          {errors.role && <p className="mt-2 text-sm font-medium text-red-700">{errors.role}</p>}
          <TextField className="mt-5" label="Nazwa dokumentu" value={draft.title} onChange={(e) => patch({ title: e.target.value })} hint="Widoczna dla obu stron, np. „Najem – ul. Polna 12”." />
        </Card>
      )}

      {draft.step === 1 && (
        <div className="space-y-4">
          {draft.parties.map((p) => (
            <Card key={p.id} className="p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-ink-900">
                  {p.role} {p.id === draft.myRole && <span className="ml-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800">Ty</span>}
                </h2>
                <div role="radiogroup" aria-label={`Rodzaj strony: ${p.role}`} className="flex rounded-xl bg-slate-100 p-1">
                  {(['osoba', 'firma'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={p.kind === k}
                      onClick={() => setParty(p.id, { kind: k })}
                      className={cx('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium', p.kind === k ? 'bg-white text-ink-900 shadow-sm' : 'text-slate-600')}
                    >
                      {k === 'osoba' ? <User className="size-3.5" aria-hidden /> : <Building2 className="size-3.5" aria-hidden />}
                      {k === 'osoba' ? 'Osoba' : 'Firma'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  className="sm:col-span-2"
                  label={p.kind === 'firma' ? 'Nazwa firmy' : 'Imię i nazwisko'}
                  value={p.name}
                  onChange={(e) => setParty(p.id, { name: e.target.value })}
                  error={errors[`${p.id}.name`]}
                  autoComplete={p.id === draft.myRole ? (p.kind === 'firma' ? 'organization' : 'name') : 'off'}
                />
                <AddressFields value={p.address} onChange={(address) => setParty(p.id, { address })} firm={p.kind === 'firma'} />
                <TextField label={p.kind === 'firma' ? 'NIP lub KRS' : 'PESEL'} value={p.idNumber} onChange={(e) => setParty(p.id, { idNumber: e.target.value })} optional inputMode="numeric" hint={p.id !== draft.myRole ? 'Jeśli nie znasz – kontrahent uzupełni.' : undefined} />
                <TextField label="E-mail" type="email" value={p.email} onChange={(e) => setParty(p.id, { email: e.target.value })} optional error={errors[`${p.id}.email`]} inputMode="email" />
                {p.kind === 'firma' && <TextField label="Osoba reprezentująca" value={p.representative} onChange={(e) => setParty(p.id, { representative: e.target.value })} optional />}
              </div>
              {p.id === draft.myRole && !p.name && (
                <button
                  type="button"
                  className="mt-3 text-sm font-medium text-brand-700 hover:underline"
                  onClick={() =>
                    setParty(p.id, state.profile.ownParty ? { ...state.profile.ownParty } : { email: state.profile.email, ...(p.kind === 'osoba' ? { name: state.profile.name } : {}) })
                  }
                >
                  {state.profile.ownParty ? `Uzupełnij moimi zapisanymi danymi (${state.profile.ownParty.name})` : 'Uzupełnij moimi danymi z profilu'}
                </button>
              )}
              {p.id === draft.myRole &&
                p.name &&
                (p.address || p.idNumber) &&
                (!state.profile.ownParty || state.profile.ownParty.name !== p.name || state.profile.ownParty.address !== p.address || state.profile.ownParty.idNumber !== p.idNumber) && (
                  <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl bg-brand-50/60 p-3 text-sm text-slate-700 ring-1 ring-brand-100">
                    <input type="checkbox" checked={rememberOwn} onChange={(e) => setRememberOwn(e.target.checked)} className="mt-0.5 size-4 accent-brand-600" />
                    <span>
                      <span className="font-medium text-ink-900">{state.profile.ownParty ? 'Zaktualizuj moje zapisane dane' : 'Zapamiętaj moje dane'}</span>
                      <span className="block text-xs text-slate-500">W kolejnych umowach uzupełnimy je automatycznie.</span>
                    </span>
                  </label>
                )}
            </Card>
          ))}
        </div>
      )}

      {draft.step === 2 && <TermsStep t={t} answers={draft.answers} setAnswer={setAnswer} errors={errors} />}

      {draft.step === 3 && (
        <div className="space-y-4">
          <Alert tone="info" title="Projekt do sprawdzenia">
            To przykładowy projekt złożony na podstawie Twoich odpowiedzi. Możesz edytować każdy zapis. Przed podpisaniem warto, by umowę przejrzał prawnik.
          </Alert>
          {errors.clauses && (
            <Alert tone="error" className="outline-none">
              {errors.clauses}
            </Alert>
          )}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-paper px-5 py-3">
              <p className="text-sm font-medium text-slate-700">{clauses.length} zapisów</p>
              {draft.clauses && (
                <Button size="sm" variant="ghost" onClick={() => patch({ clauses: null })} icon={<RotateCcw className="size-3.5" />}>
                  Przywróć wygenerowane
                </Button>
              )}
            </div>
            <div className="bg-paper px-5 py-6 sm:px-8">
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-700">Projekt umowy</p>
              <h2 className="mt-2 text-center font-serif text-2xl font-semibold text-ink-900">{draft.title || t.name}</h2>
              <div className="mt-6">
                <PartiesColumns parties={draft.parties} viewer={draft.myRole ?? undefined} />
              </div>
              <div className="mt-8 space-y-6">
                {clauses.map((c, i) => (
                  <EditableClause
                    key={c.id}
                    index={i}
                    clause={c}
                    onChange={(text) => patch({ clauses: clauses.map((x) => (x.id === c.id ? { ...x, text } : x)) })}
                  />
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {draft.step === 4 && (
        <Card className="p-5 sm:p-6">
          {created ? (
            <div className="text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-50 text-brand-700" aria-hidden>
                <Check className="size-7" />
              </span>
              <h2 className="mt-3 text-xl font-semibold text-ink-900">Projekt umowy jest gotowy</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
                {liveContract?.shareId ? 'Zaproszenie zostało przygotowane. Gdy kontrahent zaproponuje zmiany, zobaczysz je w widoku umowy.' : 'Zapisaliśmy projekt w Moich umowach.'}
              </p>
              <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                {!liveContract?.shareId && (
                  <Button variant="accent" onClick={() => setShareOpen(true)} icon={<Send className="size-4" />}>
                    Wyślij kontrahentowi
                  </Button>
                )}
                <ButtonLink to={`/umowy/${created.id}`} variant={liveContract?.shareId ? 'primary' : 'secondary'}>
                  Przejdź do umowy
                </ButtonLink>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-ink-900">Co dalej z projektem?</h2>
              <dl className="mt-4 grid gap-3 rounded-xl bg-sand-50 p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Dokument</dt>
                  <dd className="font-medium text-ink-900">{draft.title}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Twoja rola</dt>
                  <dd className="font-medium text-ink-900">{draft.parties.find((p) => p.id === draft.myRole)?.role}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Druga strona</dt>
                  <dd className="font-medium text-ink-900">{draft.parties.find((p) => p.id === otherParty(draft.myRole ?? 'A'))?.name}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Liczba zapisów</dt>
                  <dd className="font-medium text-ink-900">{clauses.length}</dd>
                </div>
              </dl>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => finish(true)} className="rounded-2xl bg-ink-900 p-4 text-left text-white transition hover:bg-ink-800">
                  <Send className="size-5 text-brand-300" aria-hidden />
                  <span className="mt-2 block font-semibold">Wyślij kontrahentowi</span>
                  <span className="mt-0.5 block text-sm text-white/75">Druga strona przeczyta projekt i zaproponuje zmiany.</span>
                </button>
                <button type="button" onClick={() => finish(false)} className="rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200 transition hover:ring-slate-300">
                  <Save className="size-5 text-ink-700" aria-hidden />
                  <span className="mt-2 block font-semibold text-ink-900">Zapisz jako szkic</span>
                  <span className="mt-0.5 block text-sm text-slate-600">Wrócisz do niego później w „Moich umowach”.</span>
                </button>
              </div>
            </>
          )}
        </Card>
      )}

      {!created && (
        <div className="mt-6 flex items-center justify-between gap-3">
          <Button variant="secondary" onClick={() => go(draft.step - 1)} disabled={draft.step === 0} icon={<ArrowLeft className="size-4" />}>
            Wstecz
          </Button>
          {draft.step < 4 && (
            <Button variant="primary" onClick={() => go(draft.step + 1)}>
              {draft.step === 2 ? 'Zobacz projekt' : draft.step === 3 ? 'Dalej' : 'Dalej'} <ArrowRight className="size-4" aria-hidden />
            </Button>
          )}
        </div>
      )}

      {liveContract && <ShareDialog contract={liveContract} open={shareOpen} onClose={() => setShareOpen(false)} />}
    </div>
  )
}

function TermsStep({ t, answers, setAnswer, errors }: { t: TemplateDefinition; answers: WizardAnswers; setAnswer: <K extends keyof WizardAnswers>(k: K, v: WizardAnswers[K]) => void; errors: Record<string, string> }) {
  const has = (f: FieldKey) => t.fields.includes(f)
  const opts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }))
  return (
    <div className="space-y-4">
      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-ink-900">Przedmiot i rozliczenie</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextArea className="sm:col-span-2" label={labelFor(t, 'scope')} rows={3} value={answers.scope} onChange={(e) => setAnswer('scope', e.target.value)} placeholder={t.scopeHint} error={errors.scope} hint="Opisz konkretnie – co, w jakiej ilości i jakiej jakości." />
          {has('amount') && <TextField label={labelFor(t, 'amount')} inputMode="decimal" value={answers.amount} onChange={(e) => setAnswer('amount', e.target.value.replace(/[^\d.,\s]/g, ''))} error={errors.amount} placeholder="np. 4500" />}
          {has('amountBasis') && <SelectField label={labelFor(t, 'amountBasis')} value={answers.amountBasis} onChange={(e) => setAnswer('amountBasis', e.target.value as WizardAnswers['amountBasis'])} options={opts(['ryczałt', 'miesięcznie', 'za godzinę'])} />}
          {has('paymentDays') && <TextField label={labelFor(t, 'paymentDays')} inputMode="numeric" value={answers.paymentDays} onChange={(e) => setAnswer('paymentDays', e.target.value.replace(/\D/g, ''))} hint="Liczba dni od otrzymania faktury lub rachunku." />}
          {has('deposit') && <TextField label={labelFor(t, 'deposit')} inputMode="decimal" value={answers.deposit} onChange={(e) => setAnswer('deposit', e.target.value.replace(/[^\d.,\s]/g, ''))} optional />}
        </div>
      </Card>

      {(has('startDate') || has('endDate')) && (
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-ink-900">Terminy</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {has('startDate') && <TextField label={labelFor(t, 'startDate')} type="date" value={answers.startDate} onChange={(e) => setAnswer('startDate', e.target.value)} optional />}
            {has('endDate') && <TextField label={labelFor(t, 'endDate')} type="date" value={answers.endDate} onChange={(e) => setAnswer('endDate', e.target.value)} optional error={errors.endDate} hint="Puste pole = umowa na czas nieokreślony." />}
          </div>
        </Card>
      )}

      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-ink-900">Bezpieczeństwo współpracy</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {has('liability') && <SelectField label={labelFor(t, 'liability')} value={answers.liability} onChange={(e) => setAnswer('liability', e.target.value)} options={opts(LIABILITY_OPTIONS)} />}
          {has('notice') && <SelectField label={labelFor(t, 'notice')} value={answers.notice} onChange={(e) => setAnswer('notice', e.target.value)} options={opts(NOTICE_OPTIONS)} />}
          {has('ip') && <SelectField label={labelFor(t, 'ip')} value={answers.ip} onChange={(e) => setAnswer('ip', e.target.value)} options={opts(IP_OPTIONS)} />}
          {has('penalty') && <SelectField label={labelFor(t, 'penalty')} value={answers.penalty} onChange={(e) => setAnswer('penalty', e.target.value)} options={opts(PENALTY_OPTIONS)} />}
          {has('confidentiality') && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-slate-200 sm:col-span-2">
              <input type="checkbox" checked={answers.confidentiality} onChange={(e) => setAnswer('confidentiality', e.target.checked)} className="mt-0.5 size-5 accent-brand-600" />
              <span>
                <span className="block text-sm font-medium text-slate-800">Dodaj zapis o poufności</span>
                <span className="block text-xs text-slate-500">Strony nie ujawnią informacji uzyskanych w związku z umową.</span>
              </span>
            </label>
          )}
          {has('extra') && <TextArea className="sm:col-span-2" label={labelFor(t, 'extra')} rows={3} value={answers.extra} onChange={(e) => setAnswer('extra', e.target.value)} optional placeholder="np. sposób przekazywania materiałów, godziny dostępności, ubezpieczenie" />}
        </div>
      </Card>
    </div>
  )
}

function EditableClause({ clause, index, onChange }: { clause: Clause; index: number; onChange: (text: string) => void }) {
  const [showExpl, setShowExpl] = useState(false)
  const id = `clause-${clause.id}`
  return (
    <section aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`${id}-title`} className="font-serif text-base font-semibold text-ink-900">
          § {index + 1}. {clause.title}
        </h3>
        {clause.explanation && (
          <button type="button" onClick={() => setShowExpl((s) => !s)} aria-expanded={showExpl} aria-controls={`${id}-expl`} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-50">
            <Lightbulb className="size-3.5" aria-hidden /> Co to oznacza?
            <ChevronDown className={cx('size-3.5 transition', showExpl && 'rotate-180')} aria-hidden />
          </button>
        )}
      </div>
      {showExpl && (
        <p id={`${id}-expl`} className="mt-2 rounded-xl bg-brand-50 p-3 text-sm leading-relaxed text-brand-900">
          {clause.explanation}
        </p>
      )}
      <label htmlFor={id} className="sr-only">
        Treść zapisu: {clause.title}
      </label>
      <textarea
        id={id}
        value={clause.text}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.min(14, Math.max(3, clause.text.split('\n').length + Math.ceil(clause.text.length / 90)))}
        className="mt-2 w-full resize-y rounded-xl border border-transparent bg-transparent p-2 font-serif text-[15px] leading-relaxed text-slate-800 hover:border-slate-200 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-100"
      />
    </section>
  )
}
