import type { AssistantSummary, ChatMessage, GrammarForm } from '../types'

export interface LegalChatResult {
  reply: string
  quickReplies: string[]
  done: boolean
  topicTitle: string
  summary?: AssistantSummary
}

/** Rozmowa z asystentem prawnym prowadzona przez model AI (logiczne pytania doprecyzowujące). */
export async function askLegalAssistant(messages: ChatMessage[], topic: string, persona: { addressAs: string; form: GrammarForm }): Promise<LegalChatResult> {
  const r = await fetch('/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic,
      persona,
      messages: messages.map((m) => ({ role: m.role, text: m.summary ? `${m.text}\n[Podsumowanie: ${m.summary.situation} Kroki: ${m.summary.steps.join('; ')}]` : m.text })),
    }),
  })
  const data = await r.json().catch(() => null)
  if (!r.ok || !data?.result) throw new Error(data?.error ?? 'Asystent nie odpowiedział.')
  const x = data.result
  const hasSummary = x.done && x.summary?.situation?.trim()
  return {
    reply: String(x.reply ?? ''),
    quickReplies: (x.quickReplies ?? []).slice(0, 4),
    done: !!x.done,
    topicTitle: String(x.topicTitle ?? ''),
    summary: hasSummary ? { situation: x.summary.situation, steps: x.summary.steps ?? [], documents: x.summary.documents ?? [], lawyer: { recommended: !!x.summary.lawyerRecommended, reason: x.summary.lawyerReason ?? '' } } : undefined,
  }
}
