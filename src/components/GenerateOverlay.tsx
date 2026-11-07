import { useMemo, useState } from 'react'
import type { MyTemplate } from '../types'
import { useNavigate } from 'react-router-dom'
import { Check, Loader2 } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { useToast } from './Toast'
import { getAiStatus } from '../lib/aiAnalysis'
import { generateFromPrompt, type GenerateStage } from '../lib/generate'
import { IntakeError } from '../lib/intake'
import { personaFor } from '../lib/persona'
import { collectContacts, expandMentions } from '../lib/contractAssistant'
import { cx } from '../lib/utils'

const STAGES: { id: GenerateStage; label: string }[] = [
  { id: 'reading', label: 'Rozpoznaję rodzaj umowy i dane stron' },
  { id: 'drafting', label: 'Przygotowuję projekt umowy' },
  { id: 'tailoring', label: 'Dopasowuję zapisy do Twoich oczekiwań' },
]

/** Hook „Generuj bezpłatnie” z pełnoekranowym stanem ładowania. */
export function useGenerate() {
  const { state, upsertContract } = useStore()
  const navigate = useNavigate()
  const toast = useToast()
  const [stage, setStage] = useState<GenerateStage | null>(null)
  /** Osoby z konta do wskazania przez „@”. */
  const contacts = useMemo(() => collectContacts(state.profile.ownParty, state.contracts, state.dataBook), [state.profile.ownParty, state.contracts, state.dataBook])

  const generate = async (prompt: string, opts: { templateHint?: string; myTemplateId?: string | null; myTemplate?: MyTemplate } = {}) => {
    if (stage) return
    const ai = (await getAiStatus()).ai
    if (ai) setStage('reading')
    try {
      const out = await generateFromPrompt(
        {
          prompt: expandMentions(prompt, contacts),
          displayPrompt: prompt,
          mentionLabels: contacts.filter((c) => prompt.includes(`@${c.label}`)).map((c) => c.label),
          mentioned: contacts.filter((c) => prompt.includes(`@${c.label}`)).flatMap((c) => (c.data ? [c.data] : [])),
          ai,
          authorName: state.profile.name,
          ownParty: state.profile.ownParty,
          persona: personaFor(state.profile),
          myTemplate: opts.myTemplate ?? (state.myTemplates ?? []).find((t) => t.id === opts.myTemplateId),
          templateHint: opts.templateHint,
        },
        setStage,
      )
      if (out.kind === 'redirect') navigate(out.to)
      else {
        upsertContract(out.contract)
        navigate(`/umowy/${out.contract.id}?panel=asystent&nowa=1`)
      }
    } catch (e) {
      toast(e instanceof IntakeError ? e.message : 'Nie udało się wygenerować umowy. Spróbuj ponownie.', 'error')
    } finally {
      setStage(null)
    }
  }

  const overlay = stage ? (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-ink-950/60 p-4 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <p className="font-serif text-xl font-semibold text-ink-900">Generuję umowę…</p>
        <ol className="mt-4 space-y-3">
          {STAGES.map((s) => {
            const idx = STAGES.findIndex((x) => x.id === stage)
            const i = STAGES.findIndex((x) => x.id === s.id)
            return (
              <li key={s.id} className="flex items-center gap-3 text-sm">
                <span className={cx('grid size-6 place-items-center rounded-full', i < idx ? 'bg-brand-600 text-white' : i === idx ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-400')}>
                  {i < idx ? <Check className="size-3.5" aria-hidden /> : i === idx ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <span className="size-1.5 rounded-full bg-current" />}
                </span>
                <span className={i <= idx ? 'text-ink-900' : 'text-slate-500'}>{s.label}</span>
              </li>
            )
          })}
        </ol>
        <p className="mt-4 text-xs text-slate-500">To zwykle zajmuje 10–30 sekund.</p>
      </div>
    </div>
  ) : null

  return { generate, overlay, busy: !!stage, contacts }
}
