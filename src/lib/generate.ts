import type { ChatMessage, Contract, GrammarForm, MyTemplate, SavedParty } from '../types'
import {
  buildContractFromIntake,
  buildContractFromMyTemplate,
  emptyIntake,
  guessTemplate,
  ownDataDiffers,
  ownPartyOf,
  retargetMyTemplateContract,
  sendIntake,
  type IntakeParty,
  type IntakeState,
} from './intake'
import { applyAssistantResult, askContractAssistant } from './contractAssistant'
import { getTemplate } from '../data/templates'
import { parseFreeParty } from './partyText'
import { nowIso, uid } from './utils'

/**
 * „Generuj bezpłatnie”: z jednego opisu od razu powstaje projekt umowy,
 * a asystent dopasowuje go do oczekiwań i mówi, czego jeszcze brakuje.
 */

export type GenerateStage = 'reading' | 'drafting' | 'tailoring'

export interface GenerateInput {
  prompt: string
  ai: boolean
  authorName: string
  ownParty?: SavedParty
  persona: { addressAs: string; form: GrammarForm }
  myTemplate?: MyTemplate
  /** Wzór wskazany na stronie wzoru – podpowiedź dla modelu. */
  templateHint?: string
  /** Osoby wskazane przez „@” – dane z konta (pierwsza inna niż Ty = druga strona). */
  mentioned?: SavedParty[]
}

export type GenerateOutcome = { kind: 'contract'; contract: Contract } | { kind: 'redirect'; to: string }

function stateFromMyTemplate(mt: MyTemplate): IntakeState {
  const base = emptyIntake()
  const own = mt.parties.find((p) => p.id === mt.ownerPartyId)!
  const ownIntake: IntakeParty = { kind: own.kind, name: own.name, address: own.address, idNumber: own.idNumber, email: own.email, representative: own.representative }
  return { ...base, templateId: mt.templateId ?? '', myTemplateId: mt.id, myRole: mt.ownerPartyId, partyA: mt.ownerPartyId === 'A' ? ownIntake : base.partyA, partyB: mt.ownerPartyId === 'B' ? ownIntake : base.partyB, answers: { ...base.answers, scope: '(z Twojego wzoru)' } }
}

export async function generateFromPrompt(input: GenerateInput, onStage: (s: GenerateStage) => void): Promise<GenerateOutcome> {
  const prompt = input.prompt.trim()

  // Bez modelu AI: umowa ze wzoru z tym, co da się odczytać z opisu, i asystent w trybie podstawowym.
  const toIntake = (d: SavedParty): IntakeParty => ({ kind: d.kind, name: d.name, address: d.address ?? '', idNumber: d.idNumber ?? '', email: d.email ?? '', representative: d.representative ?? '' })
  const mentionedOther = (input.mentioned ?? []).find((m) => m.name.trim().toLowerCase() !== input.ownParty?.name.trim().toLowerCase())

  // Bez modelu AI, z Twojego wzoru: podmieniamy dane drugiej strony na wskazane przez „@”.
  if (!input.ai && input.myTemplate) {
    onStage('drafting')
    const mt = input.myTemplate
    const state = stateFromMyTemplate(mt)
    const counterparty = mentionedOther ?? parseFreeParty(prompt) ?? undefined
    if (counterparty) {
      const other = toIntake(counterparty)
      if (mt.ownerPartyId === 'A') state.partyB = other
      else state.partyA = other
    }
    let c = buildContractFromMyTemplate(mt, state, input.authorName)
    c = await retargetMyTemplateContract(c, mt, false)
    const msgs: ChatMessage[] = [
      { id: uid('m'), role: 'user', text: prompt, createdAt: nowIso() },
      {
        id: uid('m'),
        role: 'assistant',
        text: counterparty
          ? `Przygotowałem umowę z Twojego wzoru „${mt.name}” i wpisałem dane drugiej strony: ${counterparty.name}${counterparty.address ? `, ${counterparty.address}` : ''}. Sprawdź kolumny stron i miejsca do uzupełnienia.`
          : `Przygotowałem umowę z Twojego wzoru „${mt.name}”. Uzupełnij dane drugiej strony przyciskiem „Edytuj” przy kolumnach (albo wskaż ją przez „@” w wiadomości).`,
        createdAt: nowIso(),
      },
    ]
    return { kind: 'contract', contract: { ...c, privateChats: { [c.ownerPartyId]: msgs } } }
  }

  if (!input.ai) {
    const id = input.templateHint ?? guessTemplate(prompt)
    const t = getTemplate(id ?? undefined)
    if (!t) return { kind: 'redirect', to: '/wzory' }
    onStage('drafting')
    const state = emptyIntake()
    state.templateId = t.id
    state.myRole = 'A'
    const amount = prompt.match(/(\d[\d\s.]*\d|\d)(?:,\d{2})?\s*(?:zł|pln|złotych)/i)?.[1]?.replace(/[\s.]/g, '')
    if (amount) state.answers.amount = amount
    const wishes = prompt.replace(/^Chcę utworzyć:[^.]*\.\s*/i, '').replace(/^Zależy mi na:\s*/i, '').trim()
    if (wishes) state.answers.extra = `Ustalenia, na których zależy Stronom: ${wishes.replace(/[.\s]+$/, '')}.`
    if (input.ownParty) state.partyA = toIntake(input.ownParty)
    if (mentionedOther) state.partyB = toIntake(mentionedOther)
    let c = buildContractFromIntake(state, input.authorName)
    const missing = [!c.parties[0].name && `dane strony „${t.roles[0]}”`, !c.parties[1].name && `dane strony „${t.roles[1]}”`, `przedmiot umowy (§ 2)`, !amount && t.fields.includes('amount') && 'kwotę'].filter(Boolean)
    const msgs: ChatMessage[] = [
      { id: uid('m'), role: 'user', text: prompt, createdAt: nowIso() },
      {
        id: uid('m'),
        role: 'assistant',
        text: `Przygotowałem projekt „${t.name}”${wishes ? ' i zapisałem Twoje oczekiwania w paragrafie „Dodatkowe ustalenia”' : ''}. Uzupełnij jeszcze: ${missing.join(', ')}. Dane stron poprawisz przyciskiem „Edytuj” przy kolumnach, a każdy zapis – klikając jego tytuł.`,
        createdAt: nowIso(),
      },
    ]
    c = { ...c, privateChats: { [c.ownerPartyId]: msgs } }
    return { kind: 'contract', contract: c }
  }

  onStage('reading')
  const userMsg: ChatMessage = { id: uid('m'), role: 'user', text: prompt, createdAt: nowIso() }
  const base = input.myTemplate ? stateFromMyTemplate(input.myTemplate) : emptyIntake()
  const intakeText = input.templateHint && !input.myTemplate ? `${prompt}\n\n(Wybrany wzór: ${getTemplate(input.templateHint)?.name ?? input.templateHint})` : prompt
  const res = await sendIntake([{ ...userMsg, text: intakeText }], base, input.ownParty, { persona: input.persona, myTemplate: input.myTemplate })
  const { reply: intakeReply, quickReplies, ownDataInLastMessage, ...state } = res
  if (!state.templateId && !input.myTemplate && input.templateHint) state.templateId = input.templateHint
  if (!getTemplate(state.templateId) && !input.myTemplate) {
    // Model nie rozpoznał rodzaju umowy – kontynuujemy rozmowę na ekranie „Nowa umowa”.
    return { kind: 'redirect', to: `/nowa?q=${encodeURIComponent(prompt)}` }
  }
  if (!state.myRole) {
    // Rola niejasna: użytkownik to strona, której dane są puste (druga jest już opisana).
    state.myRole = state.partyA.name && !state.partyB.name ? 'B' : 'A'
  }
  // Zapisane dane użytkownika uzupełniają jego stronę, jeśli model jej nie wypełnił.
  const own = state.myRole === 'A' ? state.partyA : state.partyB
  if (!own.name && input.ownParty) {
    const filled = { ...input.ownParty }
    if (state.myRole === 'A') state.partyA = filled
    else state.partyB = filled
  }

  onStage('drafting')
  let c = input.myTemplate ? buildContractFromMyTemplate(input.myTemplate, state, input.authorName) : buildContractFromIntake(state, input.authorName)
  if (input.myTemplate) c = await retargetMyTemplateContract(c, input.myTemplate, true)
  c = { ...c, ownDataConfirmed: !(ownDataInLastMessage && ownDataDiffers(ownPartyOf(state), input.ownParty)) }

  onStage('tailoring')
  const messages: ChatMessage[] = [userMsg]
  try {
    const tailorMsg: ChatMessage = {
      ...userMsg,
      text: `${prompt}\n\n[Projekt umowy został właśnie wygenerowany na podstawie tej wiadomości. Jeśli moje oczekiwania z wiadomości nie są jeszcze uwzględnione w treści, wprowadź je. Potem krótko napisz, co przygotowałeś (z odwołaniami do paragrafów) i jakich danych jeszcze brakuje.]`,
    }
    const ar = await askContractAssistant(c, c.ownerPartyId, [tailorMsg], { persona: input.persona })
    const applied = applyAssistantResult(c, ar, c.ownerPartyId, input.authorName)
    c = applied.contract
    messages.push({ id: uid('m'), role: 'assistant', text: ar.reply, createdAt: nowIso(), changes: applied.changes.length ? applied.changes : undefined, undo: applied.undo, quickReplies: ar.quickReplies?.slice(0, 3) })
  } catch {
    messages.push({ id: uid('m'), role: 'assistant', text: intakeReply, createdAt: nowIso(), quickReplies })
  }
  c = { ...c, privateChats: { ...c.privateChats, [c.ownerPartyId]: messages } }
  return { kind: 'contract', contract: c }
}
