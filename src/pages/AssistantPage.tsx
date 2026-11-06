import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowUp,
  BadgeCheck,
  Briefcase,
  ClipboardList,
  FileText,
  Footprints,
  Handshake,
  HeartCrack,
  HelpCircle,
  MessageSquarePlus,
  MessagesSquare,
  Paperclip,
  Receipt,
  Scale,
  ShoppingBag,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { useStore } from '../store/AppStore'
import { TOPICS, detectTopic, getTopic, type Topic } from '../data/assistantTopics'
import type { AssistantSummary, ChatMessage, Conversation, GrammarForm } from '../types'
import { extractText, ExtractError } from '../lib/extract'
import { analyzeContract, parseClauses } from '../lib/analyzer'
import { cx, formatRelative, nowIso, sleep, uid, wordCount } from '../lib/utils'
import { Alert, Button, EmptyState, TextField } from '../components/ui'
import { FormPicker } from '../components/ProfileModal'
import { adapt, greet, personaFor, suggestVocative } from '../lib/persona'
import { useToast } from '../components/Toast'

const ICONS: Record<string, typeof Scale> = { rozwod: HeartCrack, umowy: Handshake, konsument: ShoppingBag, firma: Briefcase, znaki: Tag, dlugi: Receipt, inne: HelpCircle }

const msg = (role: ChatMessage['role'], text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({ id: uid('m'), role, text, createdAt: nowIso(), ...extra })

function questionMessage(t: Topic, step: number): ChatMessage {
  const q = t.questions[step]
  return msg('assistant', q.text, { quickReplies: q.options })
}

export default function AssistantPage() {
  const { chatId } = useParams()
  const { state, upsertConversation, updateConversation, deleteConversation } = useStore()
  const navigate = useNavigate()
  const toast = useToast()
  const conv = state.conversations.find((c) => c.id === chatId)
  const persona = personaFor(state.profile)
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [attachBusy, setAttachBusy] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const conversations = [...state.conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [conv?.messages.length, thinking])

  const append = (id: string, messages: ChatMessage[], patch: Partial<Conversation> = {}) =>
    updateConversation(id, (c) => ({ ...c, ...patch, messages: [...c.messages, ...messages], updatedAt: nowIso() }))

  const start = async (topic: Topic, freeText?: string) => {
    const id = uid('chat')
    const answers: Record<string, string> = {}
    const messages: ChatMessage[] = []
    if (freeText) messages.push(msg('user', freeText))
    else messages.push(msg('user', topic.title))
    const c: Conversation = {
      id,
      topicId: topic.id,
      title: freeText ? freeText.slice(0, 60) : topic.title,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      messages,
      step: 0,
      answers,
      done: false,
    }
    // Pomiń pytanie o opis, jeśli użytkownik już opisał problem.
    let step = 0
    if (freeText && topic.questions[step]?.id === 'details') {
      answers.details = freeText
      step++
    }
    upsertConversation({ ...c, step, answers })
    navigate(`/asystent/${id}`)
    setThinking(true)
    await sleep(900)
    const baseIntro = freeText && topic.id !== 'inne' ? `Dziękuję. Z opisu wynika, że sprawa może dotyczyć tematu: ${topic.title.toLowerCase()}. ${topic.intro}` : topic.intro
    const intro = greet(baseIntro, persona.addressAs)
    append(id, [msg('assistant', intro), questionMessage(topic, step)])
    setThinking(false)
  }

  const answer = async (text: string) => {
    if (!conv || !text.trim() || thinking) return
    const t = getTopic(conv.topicId)
    const value = text.trim()
    setInput('')
    append(conv.id, [msg('user', value)])
    setThinking(true)
    await sleep(700 + Math.random() * 600)

    if (conv.done) {
      append(conv.id, [followUp(value, conv)])
      setThinking(false)
      return
    }
    const q = t.questions[conv.step]
    const answers = { ...conv.answers, [q.id]: value }
    let next = conv.step + 1
    if (t.questions[next]?.id === 'details' && answers.details) next++
    if (next < t.questions.length) {
      append(conv.id, [questionMessage(t, next)], { step: next, answers })
    } else {
      const firstUser = conv.messages.find((m) => m.role === 'user')?.text ?? ''
      const summary = t.summarize(answers, firstUser === t.title ? '' : firstUser)
      append(conv.id, [msg('assistant', greet('Dziękuję za odpowiedzi. Oto podsumowanie i propozycja kolejnych kroków:', persona.addressAs), { summary }), msg('assistant', 'Jeśli chcesz coś doprecyzować, napisz – uwzględnię to. Możesz też dołączyć dokument związany ze sprawą.', { quickReplies: ['Jakie dokumenty przygotować?', 'Jak wybrać prawnika?', 'Czy jest wzór umowy dla mojej sprawy?'] })], {
        step: next,
        answers,
        done: true,
      })
    }
    setThinking(false)
  }

  const attach = async (file: File) => {
    if (!conv) return
    setAttachError(null)
    setAttachBusy(true)
    try {
      const text = await extractText(file)
      const words = wordCount(text)
      append(conv.id, [msg('user', `Dołączam dokument: ${file.name}`, { attachment: { name: file.name, words } })])
      setThinking(true)
      await sleep(900)
      const clauses = parseClauses(text)
      const a = analyzeContract(text, clauses, file.name)
      const top = a.findings.slice(0, 3)
      const reply =
        `Przejrzałem dokument „${file.name}” (ok. ${words} słów). Wygląda na: ${a.contractType.toLowerCase()}.` +
        (a.parties.length >= 2 ? ` Strony: ${a.parties.map((p) => `${p.role} – ${p.name}`).join(', ')}.` : '') +
        (top.length
          ? `\n\nNa pierwszy rzut oka warto sprawdzić:\n${top.map((f) => `• ${f.title}`).join('\n')}`
          : '\n\nNie zauważyłem typowych sygnałów ryzyka, ale to tylko pobieżna ocena.') +
        '\n\nJeśli to umowa, możesz przeprowadzić pełną analizę z komentarzami do konkretnych zapisów i propozycjami zmian w sekcji „Analizuj umowę”.'
      append(conv.id, [msg('assistant', reply, { quickReplies: ['Co oznaczają te uwagi?'] })])
    } catch (e) {
      setAttachError(e instanceof ExtractError ? e.message : 'Nie udało się dołączyć dokumentu.')
    } finally {
      setAttachBusy(false)
      setThinking(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className={cx('space-y-3', conv ? 'hidden lg:block' : 'order-2 lg:order-none')} aria-label="Twoje rozmowy">
        <Link to="/asystent" className="flex items-center justify-center gap-2 rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-ink-800">
          <MessageSquarePlus className="size-4" aria-hidden /> Nowa rozmowa
        </Link>
        <h2 className="px-1 pt-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Twoje rozmowy</h2>
        {conversations.length === 0 ? (
          <p className="rounded-xl bg-white/60 p-4 text-sm text-slate-500 ring-1 ring-slate-200">Nie masz jeszcze rozmów. Wybierz temat lub opisz swoją sprawę.</p>
        ) : (
          <ul className="space-y-1">
            {conversations.map((c) => (
              <li key={c.id} className="group relative">
                <Link to={`/asystent/${c.id}`} className={cx('block rounded-xl px-3 py-2.5 pr-10 text-sm transition', c.id === chatId ? 'bg-white font-medium text-ink-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-700 hover:bg-white/70')}>
                  <span className="block truncate">{c.title}</span>
                  <span className="block text-xs text-slate-500">{formatRelative(c.updatedAt)}</span>
                </Link>
                <button
                  type="button"
                  aria-label={`Usuń rozmowę: ${c.title}`}
                  onClick={() => {
                    deleteConversation(c.id)
                    toast('Rozmowa usunięta')
                    if (c.id === chatId) navigate('/asystent')
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 opacity-0 hover:bg-slate-100 hover:text-red-700 focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section aria-label="Rozmowa z asystentem" className="min-w-0">
        {chatId && !conv ? (
          <EmptyState icon={<MessagesSquare className="size-6" />} title="Nie znaleziono rozmowy" action={<Button onClick={() => navigate('/asystent')}>Rozpocznij nową</Button>}>
            Rozmowa mogła zostać usunięta.
          </EmptyState>
        ) : !conv ? (
          <StartScreen onTopic={(t) => start(t)} onFree={(text) => start(detectTopic(text), text)} />
        ) : (
          <div className="fixed inset-0 z-40 flex flex-col bg-white lg:static lg:z-auto lg:h-[calc(100dvh-8.5rem)] lg:rounded-3xl lg:ring-1 lg:ring-slate-200">
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-6">
              <Link to="/asystent" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Wróć do listy rozmów">
                <X className="size-5" />
              </Link>
              <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-700" aria-hidden>
                <Scale className="size-4" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate font-semibold text-ink-900">{getTopic(conv.topicId).title}</h1>
                <p className="text-xs text-slate-500">{conv.done ? 'Podsumowanie gotowe' : `Pytanie ${Math.min(conv.step + 1, getTopic(conv.topicId).questions.length)} z ${getTopic(conv.topicId).questions.length}`}</p>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
              {conv.messages.map((m, i) => (
                <Bubble key={m.id} m={m} isLast={i === conv.messages.length - 1} onQuick={answer} disabled={thinking} form={persona.form} />
              ))}
              {thinking && (
                <div className="flex items-center gap-2" role="status" aria-label="Asystent pisze">
                  <span className="grid size-8 place-items-center rounded-full bg-ink-900 text-brand-300" aria-hidden>
                    <Scale className="size-4" />
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

            <div className="safe-pb sm:safe-pb-4 border-t border-slate-100 bg-white px-3 pt-3 sm:px-4 sm:pt-4 lg:rounded-b-3xl">
              {attachError && (
                <Alert tone="error" className="mb-2" onClose={() => setAttachError(null)}>
                  {attachError}
                </Alert>
              )}
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void answer(input)
                }}
              >
                <Button type="button" variant="ghost" aria-label="Dołącz dokument" loading={attachBusy} onClick={() => fileRef.current?.click()} icon={attachBusy ? undefined : <Paperclip className="size-5" />} className="h-11 w-11 px-0" />
                <input
                  ref={fileRef}
                  type="file"
                  className="sr-only"
                  accept=".pdf,.docx,.txt,.md"
                  aria-label="Wybierz dokument do dołączenia"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void attach(f)
                    e.target.value = ''
                  }}
                />
                <label htmlFor="chat-input" className="sr-only">
                  Twoja wiadomość
                </label>
                <textarea
                  id="chat-input"
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void answer(input)
                    }
                  }}
                  placeholder={conv.done ? 'Napisz pytanie lub doprecyzuj sprawę…' : 'Odpowiedz własnymi słowami…'}
                  className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
                />
                <Button type="submit" variant="accent" aria-label="Wyślij" disabled={!input.trim() || thinking} icon={<ArrowUp className="size-5" />} className="h-11 w-11 px-0" />
              </form>
              <p className="mt-2 text-center text-[11px] text-slate-500">Asystent pomaga uporządkować sprawę i nie zastępuje porady prawnika.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function PersonaCard() {
  const { state, updateProfile } = useStore()
  const [addressAs, setAddressAs] = useState(state.profile.addressAs ?? suggestVocative(state.profile.name))
  const [form, setForm] = useState<GrammarForm | undefined>(state.profile.form)
  if (state.profile.form) return null
  return (
    <div className="mt-5 rounded-3xl bg-brand-50/70 p-4 ring-1 ring-brand-100 sm:p-5">
      <p className="font-semibold text-ink-900">Zanim zaczniemy: jak mam się do Ciebie zwracać?</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[220px_1fr] sm:items-end">
        <TextField label="Zwracaj się do mnie" value={addressAs} onChange={(e) => setAddressAs(e.target.value)} hint="Np. „Katarzyno”, „Kasiu”" />
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-800">Formy w rozmowie</p>
          <FormPicker value={form} onChange={setForm} />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button size="sm" variant="primary" disabled={!form} onClick={() => updateProfile({ ...state.profile, addressAs: addressAs.trim(), form })}>
          Zapisz
        </Button>
      </div>
    </div>
  )
}

function StartScreen({ onTopic, onFree }: { onTopic: (t: Topic) => void; onFree: (text: string) => void }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const submit = () => {
    if (text.trim().length < 15) {
      setError('Opisz sytuację nieco dokładniej (co najmniej jedno pełne zdanie).')
      return
    }
    onFree(text.trim())
  }
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Asystent AI</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">Porozmawiaj z AI</h1>
      <PersonaCard />
      <p className="mt-1.5 max-w-2xl text-[15px] text-slate-600">Opisz sprawę własnymi słowami lub wybierz temat. Asystent zada kilka pytań, a potem podsumuje sytuację i zaproponuje kolejne kroki.</p>

      <div className="mt-5 rounded-3xl bg-white p-4 ring-1 ring-slate-200 sm:p-5">
        <label htmlFor="free" className="text-sm font-medium text-slate-800">
          Opisz swój problem
        </label>
        <textarea
          id="free"
          rows={4}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setError(null)
          }}
          placeholder="Np. Kontrahent od trzech miesięcy nie płaci mi za wykonane usługi, mamy podpisaną umowę…"
          className="mt-1.5 w-full rounded-xl border border-slate-300 p-3.5 text-[15px] leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
          aria-invalid={!!error || undefined}
          aria-describedby={error ? 'free-err' : undefined}
        />
        {error && (
          <p id="free-err" className="mt-1 text-xs font-medium text-red-700">
            {error}
          </p>
        )}
        <div className="mt-3 flex justify-end">
          <Button variant="accent" onClick={submit} icon={<ArrowUp className="size-4" />}>
            Rozpocznij rozmowę
          </Button>
        </div>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-ink-900">Albo wybierz temat</h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TOPICS.map((t) => {
          const Icon = ICONS[t.id] ?? HelpCircle
          return (
            <li key={t.id}>
              <button type="button" onClick={() => onTopic(t)} className="flex h-full w-full items-start gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200 transition hover:shadow-md hover:ring-brand-300">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sand-100 text-ink-800" aria-hidden>
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block font-medium text-ink-900">{t.title}</span>
                  <span className="mt-0.5 block text-sm text-slate-600">{t.description}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Bubble({ m, isLast, onQuick, disabled, form }: { m: ChatMessage; isLast: boolean; onQuick: (t: string) => void; disabled: boolean; form: GrammarForm }) {
  if (m.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-[15px] leading-relaxed text-white">
          {m.attachment && (
            <span className="mb-1 flex items-center gap-1.5 text-sm text-white/90">
              <FileText className="size-4" aria-hidden /> {m.attachment.name} · {m.attachment.words} słów
            </span>
          )}
          <p className="whitespace-pre-wrap">{adapt(m.text, form)}</p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink-900 text-brand-300" aria-hidden>
        <Scale className="size-4" />
      </span>
      <div className="min-w-0 max-w-[90%] space-y-2">
        <div className="rounded-2xl rounded-tl-md bg-sand-50 px-4 py-2.5 text-[15px] leading-relaxed text-slate-800 ring-1 ring-slate-200">
          <p className="whitespace-pre-wrap">{adapt(m.text, form)}</p>
        </div>
        {m.summary && <SummaryCard s={m.summary} form={form} />}
        {isLast && m.quickReplies && (
          <div className="flex flex-wrap gap-2 pt-1">
            {m.quickReplies.map((q) => (
              <button key={q} type="button" disabled={disabled} onClick={() => onQuick(adapt(q, form))} className="rounded-full bg-white px-3.5 py-2 text-sm font-medium text-ink-800 ring-1 ring-slate-300 transition hover:bg-brand-50 hover:ring-brand-400 disabled:opacity-50">
                {adapt(q, form)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ s: raw, form }: { s: AssistantSummary; form: GrammarForm }) {
  const a = (t: string) => adapt(t, form)
  const s: AssistantSummary = { situation: a(raw.situation), steps: raw.steps.map(a), documents: raw.documents.map(a), lawyer: { ...raw.lawyer, reason: a(raw.lawyer.reason) } }
  return (
    <div className="animate-fade-up overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
      <div className="border-b border-slate-100 bg-brand-50/60 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">Podsumowanie sytuacji</p>
        <p className="mt-1 text-[15px] leading-relaxed text-ink-900">{s.situation}</p>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
            <Footprints className="size-4 text-brand-600" aria-hidden /> Możliwe kolejne kroki
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
            {s.steps.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
            <ClipboardList className="size-4 text-brand-600" aria-hidden /> Przygotuj
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
            {s.documents.map((x) => (
              <li key={x} className="flex gap-2">
                <FileText className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden />
                {x}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className={cx('flex gap-2.5 border-t px-4 py-3 text-sm', s.lawyer.recommended ? 'border-amber-100 bg-amber-50 text-amber-950' : 'border-slate-100 bg-sand-50 text-slate-700')}>
        <BadgeCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <span className="font-semibold">{s.lawyer.recommended ? 'Rekomendujemy konsultację z prawnikiem. ' : 'Konsultacja z prawnikiem nie jest konieczna na tym etapie. '}</span>
          {s.lawyer.reason}
        </p>
      </div>
    </div>
  )
}

function followUp(text: string, conv: Conversation): ChatMessage {
  const t = text.toLowerCase()
  const summary = [...conv.messages].reverse().find((m) => m.summary)?.summary
  if (/dokument|przygotow/.test(t) && summary) {
    return msg('assistant', `Warto zebrać:\n${summary.documents.map((d) => `• ${d}`).join('\n')}\n\nDobrze jest też spisać krótką chronologię zdarzeń z datami – ułatwi to rozmowę z drugą stroną lub prawnikiem.`)
  }
  if (/prawnik|adwokat|radc/.test(t)) {
    return msg(
      'assistant',
      'Przy wyborze prawnika zwróć uwagę na:\n• specjalizację w podobnych sprawach,\n• jasne zasady wynagrodzenia (stawka godzinowa, ryczałt),\n• to, czy jest adwokatem lub radcą prawnym – oba zawody podlegają samorządowi zawodowemu i tajemnicy.\n\nPrzygotuj na spotkanie dokumenty i chronologię zdarzeń. Bezpłatną pomoc prawną oferują też punkty nieodpłatnej pomocy prawnej w wielu gminach.',
    )
  }
  if (/wzór|wzor|umow/.test(t)) {
    return msg('assistant', 'W bibliotece „Wzory umów” znajdziesz umowy dwustronne, które możesz uzgodnić z drugą stroną – m.in. porozumienie o spłacie w ratach, ugodę, umowę wspólników czy umowę o współpracy. Kreator przeprowadzi Cię przez najważniejsze ustalenia.', { quickReplies: ['Jakie dokumenty przygotować?'] })
  }
  if (/uwag/.test(t)) {
    return msg('assistant', 'Uwagi wskazują fragmenty, które mogą być niejasne lub działać na niekorzyść jednej ze stron, np. brak limitu kar umownych albo możliwość jednostronnej zmiany warunków. W sekcji „Analizuj umowę” zobaczysz je przypięte do konkretnych zapisów wraz z wyjaśnieniem i propozycją innego brzmienia.')
  }
  return msg('assistant', 'Dziękuję, zanotowałem to. Ta informacja może mieć znaczenie dla oceny sprawy – uwzględnij ją w chronologii zdarzeń i przekaż prawnikowi, jeśli zdecydujesz się na konsultację. Czy chcesz omówić coś jeszcze?', {
    quickReplies: ['Jakie dokumenty przygotować?', 'Jak wybrać prawnika?'],
  })
}

