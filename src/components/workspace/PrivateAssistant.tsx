import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowUp, AtSign, Bot, EyeOff, FilePen, Lock, PencilLine, Undo2 } from 'lucide-react'
import type { ChatMessage, Clause, Contract, PartyId } from '../../types'
import { PRIVATE_PROMPTS, privateAnswer } from '../../lib/privateAssistant'
import { looksLikePartyData, parseFreeParty } from '../../lib/partyText'
import { mentionSubtitle, askContractAssistant, AssistantError, type AssistantResult, type Mention } from '../../lib/contractAssistant'
import { getAiStatus } from '../../lib/aiAnalysis'
import { cx, nowIso, sleep, uid } from '../../lib/utils'
import { Button } from '../ui'

const AI_PROMPTS = ['Czego brakuje w tej umowie?', 'Wyjaśnij wybrany zapis', 'Dodaj płatność w dwóch transzach', 'Uzupełnij dane drugiej strony']

/** Zamienia „§ 4” w tekście na przyciski przewijające do zapisu. */
function Linkified({ text, clauses, onOpen }: { text: string; clauses: Clause[]; onOpen: (id: string) => void }) {
  const parts: ReactNode[] = []
  const re = /§\s?(\d{1,2})/g
  let last = 0
  for (const m of text.matchAll(re)) {
    const n = Number(m[1])
    const cl = clauses[n - 1]
    if (!cl) continue
    parts.push(text.slice(last, m.index))
    parts.push(
      <button key={m.index} type="button" onClick={() => onOpen(cl.id)} className="rounded px-0.5 font-semibold text-brand-700 underline decoration-brand-300 underline-offset-2 hover:bg-brand-50">
        {m[0]}
      </button>,
    )
    last = (m.index ?? 0) + m[0].length
  }
  parts.push(text.slice(last))
  return <>{parts}</>
}

/** Tekst z wyróżnionymi @wzmiankami (dla pola wpisywania i dymków). */
function MentionText({ text, labels, tone }: { text: string; labels: string[]; tone: 'input' | 'bubble' }) {
  const sorted = [...labels].sort((a, b) => b.length - a.length)
  if (!sorted.length) return <>{text}</>
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(@(?:${sorted.map(esc).join('|')}))`, 'g')
  return (
    <>
      {text.split(re).map((part, i) =>
        re.test(part) && part.startsWith('@') ? (
          <mark key={i} className={cx('rounded-md', tone === 'input' ? 'bg-brand-100 text-transparent ring-1 ring-brand-300' : 'bg-white/20 px-1 font-semibold text-white ring-1 ring-white/30')}>
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

/** Bez modelu AI: @wzmianka uzupełnia dane strony (Twojej albo tej, której dane są puste). */
function mentionFillResult(c: Contract, viewer: PartyId, text: string, used: Mention[]): AssistantResult {
  const me = c.parties.find((p) => p.id === viewer)!
  const other = c.parties.find((p) => p.id !== viewer)!
  const t = text.toLowerCase()
  const wantsOther = /drug(a|iej|ą) stron|kontrahent|klient/.test(t) || t.includes(other.role.toLowerCase().slice(0, 6))
  const wantsMe = /\b(moj|moje|mnie|ja)\b/.test(t) || t.includes(me.role.toLowerCase().slice(0, 6))
  const order: (typeof me)[] = wantsOther && !wantsMe ? [other, me] : wantsMe ? [me, other] : !me.name ? [me, other] : !other.name ? [other, me] : [me, other]
  const updates = used.filter((m) => m.data).slice(0, 2).map((m, i) => ({ partyId: order[i].id, ...m.data!, kind: m.data!.kind }))
  const names = updates.map((u, i) => `„${order[i].role}” – ${u.name}`).join('; ')
  return {
    reply: `Uzupełniłem dane strony ${names} (zob. § 1). Jeśli trafiły do niewłaściwej strony, kliknij „Cofnij” i napisz np. „@… to dane drugiej strony” albo popraw je przyciskiem „Edytuj” przy kolumnach.`,
    edits: [],
    partyUpdates: updates,
    title: '',
    quickReplies: [],
  }
}

export function PrivateAssistant({
  contract,
  viewer,
  selected,
  enabled,
  onRequireAccount,
  onAppend,
  onUseSuggestion,
  onAssistantResult,
  onUndo,
  onOpenClause,
  contacts,
  persona,
  pendingReveal,
}: {
  contract: Contract
  viewer: PartyId
  selected: Clause | null
  enabled: boolean
  onRequireAccount: () => void
  onAppend: (messages: ChatMessage[]) => void
  onUseSuggestion: (clauseId: string, text: string) => void
  /** Nanosi wynik asystenta na umowę i dopisuje odpowiedź do rozmowy. */
  onAssistantResult: (res: AssistantResult) => void
  onUndo: (messageId: string) => void
  onOpenClause: (clauseId: string) => void
  contacts: Mention[]
  persona?: { addressAs: string; form: 'f' | 'm' | 'n' }
  /** Świeżo wygenerowana umowa: ostatnia odpowiedź pojawia się po chwili. */
  pendingReveal?: boolean
}) {
  const messages = contract.privateChats[viewer] ?? []
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ai, setAi] = useState<boolean | null>(null)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIdx, setMentionIdx] = useState(0)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void getAiStatus().then((s) => setAi(s.ai))
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.length, thinking])

  const matches = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    return contacts.filter((c) => c.label.toLowerCase().includes(q)).slice(0, 6)
  }, [mentionQuery, contacts])

  if (!enabled) {
    return (
      <div className="rounded-2xl bg-white p-5 text-center ring-1 ring-slate-200">
        <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700" aria-hidden>
          <Bot className="size-5" />
        </span>
        <h3 className="mt-3 font-semibold text-ink-900">Twój prywatny asystent</h3>
        <p className="mt-1 text-sm text-slate-600">Zadawaj pytania o umowę i proś o zmiany – rozmowę widzisz tylko Ty. Aby korzystać z asystenta, załóż bezpłatne konto.</p>
        <Button className="mt-4" variant="accent" onClick={onRequireAccount}>
          Załóż konto
        </Button>
      </div>
    )
  }

  const updateMention = (value: string, caret: number) => {
    const m = value.slice(0, caret).match(/(?:^|\s)@([\p{L}\d .-]{0,30})$/u)
    setMentionQuery(m ? m[1] : null)
    setMentionIdx(0)
  }

  const pickMention = (c: Mention) => {
    const el = inputRef.current
    const caret = el?.selectionStart ?? input.length
    const before = input.slice(0, caret).replace(/@([\p{L}\d .-]{0,30})$/u, `@${c.label} `)
    const next = before + input.slice(caret)
    setInput(next)
    setMentionQuery(null)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(before.length, before.length)
    })
  }

  const ask = async (q: string) => {
    const question = q.trim()
    if (!question || thinking) return
    setError(null)
    const used = contacts.filter((c) => question.includes(`@${c.label}`))
    const userMsg: ChatMessage = {
      id: uid('m'),
      role: 'user',
      text: selected && /wybran/i.test(question) ? `${question} („${selected.title}”)` : question,
      createdAt: nowIso(),
      mentions: used.map((u) => u.label),
    }
    onAppend([userMsg])
    setInput('')
    setMentionQuery(null)
    setThinking(true)
    // Stan AI sprawdzany przy każdej wiadomości (klucz mógł zostać właśnie włączony).
    const live = (await getAiStatus()).ai
    if (live !== ai) setAi(live)
    if (live) {
      try {
        const history = [...messages, userMsg].map((m) => ({ ...m, text: m.role === 'user' && selected && /wybran/i.test(m.text) ? `${m.text} [chodzi o zapis: ${selected.title}]` : m.text }))
        const res = await askContractAssistant(contract, viewer, history, { persona, mentions: used })
        onAssistantResult(res)
      } catch (e) {
        setError(e instanceof AssistantError ? e.message : 'Asystent nie odpowiedział.')
      }
    } else if (used.length) {
      await sleep(400)
      onAssistantResult(mentionFillResult(contract, viewer, question, used))
    } else if (looksLikePartyData(question) && parseFreeParty(question)) {
      // Bez modelu AI: dane wpisane w wiadomości („wprowadź dane klienta: Anna Kowalczyk, ul. …”)
      const data = parseFreeParty(question)!
      await sleep(400)
      onAssistantResult(mentionFillResult(contract, viewer, question, [{ label: data.name, data }]))
    } else if (/\b(zmie|dodaj|usu|popraw|wpisz|uzupełn|przeredaguj)/i.test(question)) {
      await sleep(400)
      onAppend([
        {
          id: uid('m'),
          role: 'assistant',
          text: 'Samodzielne zmiany treści przez asystenta są w tej chwili niedostępne. Możesz to zrobić od razu w dokumencie: kliknij tytuł paragrafu i wybierz „Edytuj zapis”, a dane stron popraw przyciskiem „Edytuj” przy kolumnach. Dane zapisanych osób wstawisz też przez @ – np. „@Twoja firma”.',
          createdAt: nowIso(),
        },
      ])
    } else {
      await sleep(600)
      onAppend([privateAnswer(question, contract, viewer, selected)])
    }
    setThinking(false)
  }

  const prompts = ai ? AI_PROMPTS : PRIVATE_PROMPTS

  return (
    <div className="flex flex-col rounded-2xl bg-white ring-1 ring-slate-200">
      <div className="flex items-center gap-2 rounded-t-2xl border-b border-slate-100 bg-ink-900 px-4 py-3 text-white">
        <EyeOff className="size-4 text-brand-300" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Asystent umowy</p>
          <p className="text-xs text-white/70">{ai ? 'Pyta, wyjaśnia i wprowadza zmiany na Twoją prośbę · widzisz go tylko Ty' : 'Pytania i odpowiedzi widzisz tylko Ty'}</p>
        </div>
      </div>
      <div className="max-h-[58vh] min-h-48 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-sm text-slate-600">
            {ai
              ? 'Napisz, co zmienić albo czego nie rozumiesz – np. „dodaj karę za opóźnienie”, „uzupełnij dane @…”. Zmiany zobaczysz od razu w dokumencie i możesz je cofnąć.'
              : 'Zapytaj o dowolny zapis. Asystent wyjaśnia i podpowiada, ale nie zmienia umowy bez Twojej decyzji.'}
          </p>
        )}
        {(pendingReveal && messages[messages.length - 1]?.role === 'assistant' ? messages.slice(0, -1) : messages).map((m, mi, arr) => (
          <div key={m.id} className={cx('flex', m.role === 'user' ? 'justify-end' : 'justify-start', mi === arr.length - 1 && m.role === 'assistant' && 'animate-fade-up')}>
            <div className={cx('max-w-[94%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed', m.role === 'user' ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-sand-50 text-slate-800 ring-1 ring-slate-200')}>
              <p className="whitespace-pre-wrap">{m.role === 'assistant' ? <Linkified text={m.text} clauses={contract.clauses} onOpen={onOpenClause} /> : <MentionText text={m.text} labels={m.mentions ?? []} tone="bubble" />}</p>
              {m.changes && m.changes.length > 0 && (
                <div className="mt-2 rounded-xl bg-white p-2.5 ring-1 ring-brand-200">
                  <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-800">
                    <PencilLine className="size-3.5" aria-hidden /> {m.undone ? 'Zmiany cofnięte' : 'Wprowadzone zmiany'}
                  </p>
                  <ul className="space-y-0.5">
                    {m.changes.map((ch) => (
                      <li key={ch.clauseId}>
                        <button type="button" disabled={m.undone} onClick={() => onOpenClause(ch.clauseId)} className={cx('text-left text-sm', m.undone ? 'text-slate-400 line-through' : 'font-medium text-brand-700 hover:underline')}>
                          → {ch.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {m.undo && !m.undone && (
                    <Button size="sm" variant="ghost" className="mt-1" icon={<Undo2 className="size-3.5" />} onClick={() => onUndo(m.id)}>
                      Cofnij
                    </Button>
                  )}
                </div>
              )}
              {m.suggestion && (
                <div className="mt-2 rounded-xl bg-white p-3 ring-1 ring-brand-200">
                  <p className="font-serif text-[13.5px] leading-relaxed text-ink-900">{m.suggestion.text}</p>
                  <Button size="sm" variant="secondary" className="mt-2" icon={<FilePen className="size-3.5" />} onClick={() => onUseSuggestion(m.suggestion!.clauseId, m.suggestion!.text)}>
                    Użyj jako propozycji zmiany
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
        {(thinking || pendingReveal) && (
          <div className="flex" role="status" aria-label="Asystent pisze">
            <div className="flex gap-1 rounded-2xl rounded-bl-md bg-sand-50 px-4 py-3 ring-1 ring-slate-200">
              <span className="typing-dot size-1.5 rounded-full bg-slate-500" />
              <span className="typing-dot size-1.5 rounded-full bg-slate-500" />
              <span className="typing-dot size-1.5 rounded-full bg-slate-500" />
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-slate-100 p-3">
        {selected && (
          <p className="mb-2 truncate text-xs text-slate-500">
            Wybrany zapis: <span className="font-medium text-slate-700">{selected.title}</span>
          </p>
        )}
        <div className="scrollbar-thin -mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {(messages[messages.length - 1]?.quickReplies?.length ? messages[messages.length - 1].quickReplies! : prompts).map((p) => (
            <button key={p} type="button" onClick={() => ask(p)} disabled={thinking} className="shrink-0 rounded-full bg-sand-50 px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-brand-50 hover:ring-brand-300 disabled:opacity-50">
              {p}
            </button>
          ))}
        </div>
        <form
          className="relative flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void ask(input)
          }}
        >
          {matches.length > 0 && (
            <ul role="listbox" aria-label="Osoby z Twojego konta" className="absolute bottom-full left-0 right-12 z-20 mb-2 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-slate-200">
              {matches.map((c, i) => (
                <li key={c.label} role="option" aria-selected={i === mentionIdx}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      pickMention(c)
                    }}
                    className={cx('flex w-full items-start gap-2 px-3 py-2 text-left text-sm', i === mentionIdx ? 'bg-brand-50' : 'hover:bg-slate-50')}
                  >
                    <AtSign className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink-900">{c.label}</span>
                      <span className="block truncate text-xs text-slate-500">{mentionSubtitle(c)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label htmlFor="priv-q" className="sr-only">
            Wiadomość do asystenta
          </label>
          <div className="relative min-w-0 flex-1">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-xl border border-transparent px-3 py-2.5 text-sm text-transparent" ref={backdropRef}>
            <MentionText text={input} labels={contacts.map((c) => c.label)} tone="input" />
            {'\u200b'}
          </div>
          <textarea
            id="priv-q"
            ref={inputRef}
            onScroll={(e) => {
              if (backdropRef.current) backdropRef.current.scrollTop = e.currentTarget.scrollTop
            }}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              updateMention(e.target.value, e.target.selectionStart ?? e.target.value.length)
            }}
            onKeyDown={(e) => {
              if (matches.length) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setMentionIdx((i) => (i + 1) % matches.length)
                  return
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setMentionIdx((i) => (i - 1 + matches.length) % matches.length)
                  return
                }
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault()
                  pickMention(matches[mentionIdx])
                  return
                }
                if (e.key === 'Escape') {
                  setMentionQuery(null)
                  return
                }
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void ask(input)
              }
            }}
            placeholder={ai ? 'Napisz, co zmienić… (@ – osoba z konta)' : 'Zapytaj… (@ – osoba z konta)'}
            aria-autocomplete="list"
            className="relative block max-h-36 min-h-11 w-full resize-none rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
          />
          </div>
          <Button type="submit" variant="primary" aria-label="Wyślij" disabled={!input.trim() || thinking} icon={<ArrowUp className="size-4" />} className="h-11" />
        </form>
        <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
          <Lock className="size-3" aria-hidden /> {contract.stage === 'draft' ? 'W szkicu zmiany asystenta wchodzą od razu – każdą możesz cofnąć.' : 'Zmiany asystenta trafiają do drugiej strony jako propozycje do akceptacji.'}
        </p>
      </div>
    </div>
  )
}
