import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Bot, EyeOff, FilePen, Lock } from 'lucide-react'
import type { ChatMessage, Clause, Contract, PartyId } from '../../types'
import { PRIVATE_PROMPTS, privateAnswer } from '../../lib/privateAssistant'
import { cx, nowIso, sleep, uid } from '../../lib/utils'
import { Button } from '../ui'

export function PrivateAssistant({
  contract,
  viewer,
  selected,
  enabled,
  onRequireAccount,
  onAppend,
  onUseSuggestion,
}: {
  contract: Contract
  viewer: PartyId
  selected: Clause | null
  enabled: boolean
  onRequireAccount: () => void
  onAppend: (messages: ChatMessage[]) => void
  onUseSuggestion: (clauseId: string, text: string) => void
}) {
  const messages = contract.privateChats[viewer] ?? []
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.length, thinking])

  if (!enabled) {
    return (
      <div className="rounded-2xl bg-white p-5 text-center ring-1 ring-slate-200">
        <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700" aria-hidden>
          <Bot className="size-5" />
        </span>
        <h3 className="mt-3 font-semibold text-ink-900">Twój prywatny asystent</h3>
        <p className="mt-1 text-sm text-slate-600">Zadawaj pytania o umowę – odpowiedzi zobaczysz tylko Ty. Aby korzystać z asystenta, załóż bezpłatne konto.</p>
        <Button className="mt-4" variant="accent" onClick={onRequireAccount}>
          Załóż konto
        </Button>
      </div>
    )
  }

  const ask = async (q: string) => {
    const question = q.trim()
    if (!question || thinking) return
    const userMsg: ChatMessage = { id: uid('m'), role: 'user', text: selected && /wybran/i.test(question) ? `${question} („${selected.title}”)` : question, createdAt: nowIso() }
    onAppend([userMsg])
    setInput('')
    setThinking(true)
    await sleep(700 + Math.random() * 500)
    onAppend([privateAnswer(question, contract, viewer, selected)])
    setThinking(false)
  }

  return (
    <div className="flex flex-col rounded-2xl bg-white ring-1 ring-slate-200">
      <div className="flex items-center gap-2 rounded-t-2xl border-b border-slate-100 bg-ink-900 px-4 py-3 text-white">
        <EyeOff className="size-4 text-brand-300" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Prywatny asystent</p>
          <p className="text-xs text-white/70">Pytania i odpowiedzi widzisz tylko Ty</p>
        </div>
      </div>
      <div className="max-h-[52vh] min-h-48 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-sm text-slate-600">
            Zapytaj o dowolny zapis. Asystent wyjaśnia i podpowiada, ale <strong className="font-semibold text-ink-900">nie zmienia umowy</strong> i nie wysyła niczego drugiej stronie bez Twojej decyzji.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cx('max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed', m.role === 'user' ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-sand-50 text-slate-800 ring-1 ring-slate-200')}>
              <p className="whitespace-pre-wrap">{m.text}</p>
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
        {thinking && (
          <div className="flex" role="status" aria-label="Asystent pisze">
            <div className="flex gap-1 rounded-2xl rounded-bl-md bg-sand-50 px-4 py-3 ring-1 ring-slate-200">
              <span className="typing-dot size-1.5 rounded-full bg-slate-500" />
              <span className="typing-dot size-1.5 rounded-full bg-slate-500" />
              <span className="typing-dot size-1.5 rounded-full bg-slate-500" />
            </div>
          </div>
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
          {PRIVATE_PROMPTS.map((p) => (
            <button key={p} type="button" onClick={() => ask(p)} disabled={thinking} className="shrink-0 rounded-full bg-sand-50 px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-brand-50 hover:ring-brand-300 disabled:opacity-50">
              {p}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void ask(input)
          }}
        >
          <label htmlFor="priv-q" className="sr-only">
            Pytanie do prywatnego asystenta
          </label>
          <input id="priv-q" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Zapytaj o umowę…" className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
          <Button type="submit" variant="primary" aria-label="Wyślij pytanie" disabled={!input.trim() || thinking} icon={<ArrowUp className="size-4" />} />
        </form>
        <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
          <Lock className="size-3" aria-hidden /> Asystent przedstawia perspektywę obu stron i nie zastępuje porady prawnika.
        </p>
      </div>
    </div>
  )
}
