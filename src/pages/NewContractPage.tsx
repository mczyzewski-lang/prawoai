import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowUp, BookmarkCheck, Building2, Check, ChevronDown, Circle, FilePlus2, LayoutTemplate, ListChecks, RotateCcw, Sparkles, User } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { useToast } from '../components/Toast'
import { Alert, Button, ButtonLink, Card } from '../components/ui'
import { getTemplate } from '../data/templates'
import { getAiStatus, type AiStatus } from '../lib/aiAnalysis'
import {
  buildContractFromIntake,
  emptyIntake,
  guessTemplate,
  IntakeError,
  ownDataDiffers,
  ownPartyOf,
  QUICK_STARTS,
  seedWizard,
  sendIntake,
  toSavedParty,
  type IntakeParty,
  type IntakeState,
} from '../lib/intake'
import type { ChatMessage } from '../types'
import { cx, formatDate, formatMoney, nowIso, uid } from '../lib/utils'

const KEY = 'prawoai:intake'

interface Saved {
  messages: ChatMessage[]
  state: IntakeState
  /** Pytanie o zapis danych: id wiadomości, przy której je zadano, lub status. */
  saveAsk: { messageId: string; status: 'pending' | 'saved' | 'dismissed' } | null
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Saved
  } catch {
    /* brak zapisanej rozmowy */
  }
  return { messages: [], state: emptyIntake(), saveAsk: null }
}

const msg = (role: ChatMessage['role'], text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({ id: uid('m'), role, text, createdAt: nowIso(), ...extra })

export default function NewContractPage() {
  const { state: app, updateProfile, upsertContract } = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<Saved>(load)
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ai, setAi] = useState<AiStatus | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const started = useRef(false)
  const initialQ = useRef(params.get('q') ?? '')

  useEffect(() => {
    void getAiStatus().then(setAi)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      /* ignoruj */
    }
  }, [data])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [data.messages.length, thinking])

  const send = async (text: string, base?: Saved) => {
    const value = text.trim()
    if (!value || thinking) return
    const current = base ?? data
    const userMsg = msg('user', value)
    const messages = [...current.messages, userMsg]
    setData({ ...current, messages })
    setInput('')
    setError(null)
    setThinking(true)
    try {
      const res = await sendIntake(messages, current.state, app.profile.ownParty)
      const { reply, quickReplies, ownDataInLastMessage, ...state } = res
      const assistant = msg('assistant', reply, { quickReplies })
      const own = ownPartyOf(state)
      const ask = ownDataInLastMessage && ownDataDiffers(own, app.profile.ownParty) && current.saveAsk?.status !== 'dismissed'
      setData({ messages: [...messages, assistant], state, saveAsk: ask ? { messageId: assistant.id, status: 'pending' } : current.saveAsk })
    } catch (e) {
      setError(e instanceof IntakeError ? e.message : 'Nie udało się przetworzyć wiadomości.')
      setData({ ...current, messages })
    } finally {
      setThinking(false)
    }
  }

  // Start z parametru ?q= (skróty i pole na stronie głównej)
  useEffect(() => {
    const q = params.get('q')
    if (!q || started.current || ai === null) return
    started.current = true
    setParams({}, { replace: true })
    if (!ai.ai) return
    const fresh: Saved = { messages: [], state: emptyIntake(), saveAsk: null }
    void send(q, fresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai, params])

  const reset = () => {
    setData({ messages: [], state: emptyIntake(), saveAsk: null })
    setError(null)
  }

  const s = data.state
  const tpl = getTemplate(s.templateId)
  const canCreate = !!tpl && !!s.partyA.name && !!s.partyB.name && !!s.answers.scope
  const own = ownPartyOf(s)

  const create = () => {
    if (!canCreate) return
    const c = buildContractFromIntake(s, app.profile.name)
    upsertContract(c)
    localStorage.removeItem(KEY)
    toast('Projekt umowy jest gotowy – możesz go edytować i wysłać kontrahentowi')
    navigate(`/umowy/${c.id}`)
  }

  const saveOwn = (yes: boolean) => {
    if (!data.saveAsk) return
    if (yes && own) {
      updateProfile({ ...app.profile, ownParty: toSavedParty(own) })
      toast('Zapisano Twoje dane – uzupełnimy je automatycznie w kolejnych umowach')
    }
    setData({ ...data, saveAsk: { ...data.saveAsk, status: yes ? 'saved' : 'dismissed' } })
  }

  const fallbackTemplate = guessTemplate(initialQ.current || data.messages[0]?.text || '')

  if (ai && !ai.ai) {
    const t = getTemplate(fallbackTemplate ?? undefined)
    return (
      <div className="mx-auto max-w-2xl">
        <Header />
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-ink-900">Utwórz umowę w kreatorze</h2>
          <p className="mt-1 text-sm text-slate-600">Kreator przeprowadzi Cię przez najważniejsze ustalenia krok po kroku.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {t && (
              <ButtonLink to={`/wzory/${t.id}`} variant="accent" icon={<FilePlus2 className="size-4" />}>
                {t.name}
              </ButtonLink>
            )}
            <ButtonLink to="/wzory" variant="secondary" icon={<LayoutTemplate className="size-4" />}>
              Wybierz wzór z biblioteki
            </ButtonLink>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <div className="mx-auto max-w-3xl">
        <Header onReset={data.messages.length ? reset : undefined} />
        {data.messages.length > 0 && (
          <div className="sticky top-16 z-20 -mx-4 mb-3 bg-sand-50/95 px-4 py-2 backdrop-blur sm:mx-0 sm:px-0">
            <div className="rounded-2xl bg-white ring-1 ring-slate-200">
              <div className="flex items-center gap-3 px-4 py-2.5">
                <button type="button" onClick={() => setSummaryOpen((o) => !o)} aria-expanded={summaryOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm">
                  <ListChecks className="size-4 shrink-0 text-brand-700" aria-hidden />
                  <span className="truncate font-medium text-ink-900">{tpl ? s.title || tpl.name : 'Twój projekt'}</span>
                  <span className="hidden shrink-0 text-xs text-slate-500 sm:inline">· {progress(s)}/5 gotowe</span>
                  <ChevronDown className={cx('size-4 shrink-0 text-slate-500 transition', summaryOpen && 'rotate-180')} aria-hidden />
                </button>
                <Button size="sm" variant="accent" disabled={!canCreate} onClick={create} icon={<FilePlus2 className="size-4" />}>
                  <span className="hidden sm:inline">Utwórz projekt</span>
                  <span className="sm:hidden">Utwórz</span>
                </Button>
              </div>
              <div className="h-1 overflow-hidden rounded-b-2xl bg-slate-100">
                <div className="h-full bg-brand-500 transition-all" style={{ width: `${(progress(s) / 5) * 100}%` }} />
              </div>
              {summaryOpen && (
                <div className="max-h-[60dvh] overflow-y-auto border-t border-slate-100 px-4 pb-4">
                  <Summary s={s} canCreate={canCreate} onCreate={create} onWizard={() => navigate(seedWizard(s))} compact />
                </div>
              )}
            </div>
          </div>
        )}
        <section className="flex min-h-[calc(100dvh-15rem)] flex-col rounded-3xl bg-white ring-1 ring-slate-200" aria-label="Rozmowa">
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
            {data.messages.length === 0 && !thinking && <Intro onPick={(p) => send(p)} hasSaved={!!app.profile.ownParty} savedName={app.profile.ownParty?.name} />}
            {data.messages.map((m, i) => (
              <div key={m.id}>
                {m.role === 'user' ? (
                  <div className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-[15px] leading-relaxed text-white">{m.text}</p>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink-900 text-brand-300" aria-hidden>
                      <Sparkles className="size-4" />
                    </span>
                    <div className="min-w-0 max-w-[90%] space-y-2">
                      <p className="whitespace-pre-wrap rounded-2xl rounded-tl-md bg-sand-50 px-4 py-2.5 text-[15px] leading-relaxed text-slate-800 ring-1 ring-slate-200">{m.text}</p>
                      {data.saveAsk?.messageId === m.id && own && (
                        <SaveOwnCard party={own} status={data.saveAsk.status} onDecide={saveOwn} replace={!!app.profile.ownParty} />
                      )}
                      {i === data.messages.length - 1 && !thinking && m.quickReplies && m.quickReplies.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {m.quickReplies.map((q) => (
                            <button key={q} type="button" onClick={() => send(q)} className="rounded-full bg-white px-3.5 py-2 text-sm font-medium text-ink-800 ring-1 ring-slate-300 transition hover:bg-brand-50 hover:ring-brand-400">
                              {q}
                            </button>
                          ))}
                        </div>
                      )}
                      {i === data.messages.length - 1 && !thinking && s.ready && canCreate && (
                        <Button variant="accent" onClick={create} icon={<FilePlus2 className="size-4" />}>
                          Utwórz projekt umowy
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {thinking && (
              <div className="flex items-center gap-2" role="status" aria-label="Asystent pisze">
                <span className="grid size-8 place-items-center rounded-full bg-ink-900 text-brand-300" aria-hidden>
                  <Sparkles className="size-4" />
                </span>
                <div className="flex gap-1 rounded-2xl bg-sand-50 px-4 py-3 ring-1 ring-slate-200">
                  <span className="typing-dot size-1.5 rounded-full bg-slate-500" />
                  <span className="typing-dot size-1.5 rounded-full bg-slate-500" />
                  <span className="typing-dot size-1.5 rounded-full bg-slate-500" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="safe-bottom sticky bottom-16 rounded-b-3xl border-t border-slate-100 bg-white p-3 sm:p-4 md:bottom-0">
            {error && (
              <Alert tone="error" className="mb-2" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void send(input)
              }}
            >
              <label htmlFor="intake-input" className="sr-only">
                Twoja wiadomość
              </label>
              <textarea
                id="intake-input"
                rows={data.messages.length ? 1 : 2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send(input)
                  }
                }}
                placeholder={data.messages.length ? 'Odpowiedz lub wklej dane…' : 'Np. Umowa zlecenia z Janem Kowalskim na obsługę stoiska 12–14 grudnia, 3000 zł'}
                className="max-h-48 min-h-11 flex-1 resize-none rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
              <Button type="submit" variant="accent" aria-label="Wyślij" disabled={!input.trim() || thinking} icon={<ArrowUp className="size-5" />} className="h-11 w-11 px-0" />
            </form>
            <p className="mt-2 text-center text-[11px] text-slate-500">Możesz wkleić dane stron w dowolnej formie – asystent sam je rozpozna. Projekt to wzór przykładowy do sprawdzenia.</p>
          </div>
        </section>

      </div>
    </div>
  )
}

function progress(s: IntakeState): number {
  const tpl = getTemplate(s.templateId)
  return [!!tpl, !!s.myRole, !!s.partyA.name && !!s.partyB.name, !!s.answers.scope, !!s.answers.amount || (!!tpl && !tpl.fields.includes('amount'))].filter(Boolean).length
}

function Header({ onReset }: { onReset?: () => void }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Nowa umowa</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">Opisz, jaką umowę potrzebujesz</h1>
      </div>
      {onReset && (
        <Button variant="ghost" size="sm" onClick={onReset} icon={<RotateCcw className="size-4" />}>
          Zacznij od nowa
        </Button>
      )}
    </div>
  )
}

function Intro({ onPick, hasSaved, savedName }: { onPick: (p: string) => void; hasSaved: boolean; savedName?: string }) {
  return (
    <div className="py-4">
      <p className="text-[15px] leading-relaxed text-slate-700">
        Napisz własnymi słowami, czego dotyczy umowa i z kim ją zawierasz. Dopytam o brakujące informacje, a potem przygotuję projekt, który możesz edytować i wysłać drugiej stronie.
      </p>
      {hasSaved && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-brand-800">
          <BookmarkCheck className="size-4" aria-hidden /> Twoje zapisane dane ({savedName}) uzupełnię automatycznie.
        </p>
      )}
      <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">Albo zacznij od</p>
      <div className="flex flex-wrap gap-2">
        {QUICK_STARTS.map((q) => (
          <button key={q.label} type="button" onClick={() => onPick(q.prompt)} className="rounded-full bg-white px-3.5 py-2 text-sm font-medium text-ink-800 ring-1 ring-slate-300 transition hover:bg-brand-50 hover:ring-brand-400">
            {q.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SaveOwnCard({ party, status, onDecide, replace }: { party: IntakeParty; status: 'pending' | 'saved' | 'dismissed'; onDecide: (yes: boolean) => void; replace: boolean }) {
  if (status === 'dismissed') return null
  return (
    <div className="animate-fade-up rounded-2xl bg-white p-4 ring-1 ring-brand-200">
      {status === 'saved' ? (
        <p className="flex items-center gap-2 text-sm font-medium text-brand-800">
          <Check className="size-4" aria-hidden /> Zapisano Twoje dane w profilu.
        </p>
      ) : (
        <>
          <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <BookmarkCheck className="size-4 text-brand-700" aria-hidden /> {replace ? 'Zaktualizować zapisane dane?' : 'Zapisać Twoje dane na przyszłość?'}
          </p>
          <p className="mt-1 text-sm text-slate-600">W kolejnych umowach uzupełnimy je automatycznie i nie będziemy o nie pytać.</p>
          <dl className="mt-2 space-y-0.5 rounded-xl bg-sand-50 p-3 text-sm">
            <div className="font-medium text-ink-900">{party.name}</div>
            {party.address && <div className="text-slate-700">{party.address}</div>}
            {party.idNumber && <div className="text-slate-700">{party.kind === 'osoba' ? 'PESEL' : 'NIP/KRS'}: {party.idNumber}</div>}
            {party.email && <div className="text-slate-700">{party.email}</div>}
          </dl>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="primary" onClick={() => onDecide(true)}>
              {replace ? 'Zaktualizuj' : 'Zapisz dane'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDecide(false)}>
              Nie teraz
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function Summary({ s, canCreate, onCreate, onWizard, compact }: { s: IntakeState; canCreate: boolean; onCreate: () => void; onWizard: () => void; compact?: boolean }) {
  const tpl = getTemplate(s.templateId)
  const a = s.answers
  const steps: [string, boolean][] = [
    ['Rodzaj umowy', !!tpl],
    ['Twoja rola', !!s.myRole],
    ['Strony umowy', !!s.partyA.name && !!s.partyB.name],
    ['Przedmiot umowy', !!a.scope],
    ['Wynagrodzenie / kwota', !!a.amount || (!!tpl && !tpl.fields.includes('amount'))],
  ]
  const done = steps.filter(([, ok]) => ok).length
  const partyLine = (p: IntakeParty, role: string, isMe: boolean) => (
    <div className="rounded-xl bg-sand-50 p-3">
      <p className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-brand-700">
        {role} {isMe && <span className="rounded-full bg-brand-100 px-1.5 normal-case tracking-normal text-brand-800">Ty</span>}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-ink-900">
        {p.kind === 'firma' ? <Building2 className="size-3.5 text-slate-500" aria-hidden /> : <User className="size-3.5 text-slate-500" aria-hidden />}
        {p.name || <span className="font-normal italic text-slate-400">jeszcze nie wiem</span>}
      </p>
      {(p.address || p.idNumber) && <p className="mt-0.5 text-xs text-slate-600">{[p.address, p.idNumber].filter(Boolean).join(' · ')}</p>}
    </div>
  )
  return (
    <div className={cx(!compact && 'rounded-3xl bg-white p-5 ring-1 ring-slate-200')}>
      {!compact && (
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink-900">Twój projekt</h2>
          <span className="text-xs text-slate-500">
            {done}/{steps.length}
          </span>
        </div>
      )}
      {!compact && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
      )}
      <ul className="mt-4 space-y-1.5 text-sm">
        {steps.map(([label, ok]) => (
          <li key={label} className="flex items-center gap-2">
            {ok ? <Check className="size-4 text-brand-600" aria-hidden /> : <Circle className="size-4 text-slate-300" aria-hidden />}
            <span className={ok ? 'text-ink-900' : 'text-slate-500'}>{label}</span>
          </li>
        ))}
      </ul>
      {tpl && (
        <div className="mt-4 space-y-2">
          <p className="font-serif text-[15px] font-semibold text-ink-900">{s.title || tpl.name}</p>
          <p className="text-xs text-slate-500">Wzór: {tpl.name}</p>
          {partyLine(s.partyA, tpl.roles[0], s.myRole === 'A')}
          {partyLine(s.partyB, tpl.roles[1], s.myRole === 'B')}
          <dl className="space-y-1 pt-1 text-sm">
            {a.scope && (
              <div>
                <dt className="text-xs text-slate-500">Przedmiot</dt>
                <dd className="text-slate-800">{a.scope}</dd>
              </div>
            )}
            {a.amount && (
              <div>
                <dt className="text-xs text-slate-500">Kwota</dt>
                <dd className="text-slate-800">
                  {formatMoney(a.amount)}
                  {a.amountBasis ? ` (${a.amountBasis})` : ''}
                </dd>
              </div>
            )}
            {(a.startDate || a.endDate) && (
              <div>
                <dt className="text-xs text-slate-500">Terminy</dt>
                <dd className="text-slate-800">
                  {a.startDate ? `od ${formatDate(a.startDate)}` : ''} {a.endDate ? `do ${formatDate(a.endDate)}` : ''}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
      <div className="mt-5 space-y-2">
        <Button variant="accent" className="w-full" disabled={!canCreate} onClick={onCreate} icon={<FilePlus2 className="size-4" />}>
          Utwórz projekt umowy
        </Button>
        {tpl && (
          <Button variant="secondary" className="w-full" onClick={onWizard}>
            Dopracuj w kreatorze krok po kroku
          </Button>
        )}
        {!canCreate && <p className="text-center text-xs text-slate-500">Uzupełnij rodzaj umowy, strony i przedmiot, aby utworzyć projekt.</p>}
        {!tpl && (
          <p className="text-center text-xs text-slate-500">
            Wolisz formularz?{' '}
            <Link to="/wzory" className="font-medium text-brand-700 hover:underline">
              Wybierz wzór z biblioteki
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
