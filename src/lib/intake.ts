import type { ChatMessage, Contract, Party, PartyId, PartyKind, SavedParty } from '../types'
import { TEMPLATES, getCategory, getTemplate } from '../data/templates'
import { DEFAULT_ANSWERS, generateClauses, IP_OPTIONS, LIABILITY_OPTIONS, NOTICE_OPTIONS, PENALTY_OPTIONS, type WizardAnswers } from './contractGenerator'
import { nowIso, uid } from './utils'

/** Tworzenie umowy z opisu: stan rozmowy z modelem AI (serwer /api/intake). */

export interface IntakeParty {
  kind: PartyKind | ''
  name: string
  address: string
  idNumber: string
  email: string
  representative: string
}

export interface IntakeState {
  templateId: string
  title: string
  myRole: PartyId | ''
  partyA: IntakeParty
  partyB: IntakeParty
  answers: Omit<WizardAnswers, 'confidentiality' | 'amountBasis'> & { amountBasis: WizardAnswers['amountBasis'] | ''; confidentiality: 'tak' | 'nie' | '' }
  ready: boolean
}

export interface IntakeResult extends IntakeState {
  reply: string
  ownDataInLastMessage: boolean
  quickReplies: string[]
}

const emptyParty = (): IntakeParty => ({ kind: '', name: '', address: '', idNumber: '', email: '', representative: '' })

export function emptyIntake(): IntakeState {
  return {
    templateId: '',
    title: '',
    myRole: '',
    partyA: emptyParty(),
    partyB: emptyParty(),
    answers: { scope: '', amount: '', amountBasis: '', paymentDays: '', startDate: '', endDate: '', deposit: '', liability: '', notice: '', ip: '', penalty: '', confidentiality: '', extra: '' },
    ready: false,
  }
}

export class IntakeError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

/** Usuwa przedrostki typu „NIP”, „PESEL:” z numeru. */
function cleanId(v: string): string {
  return v.replace(/^\s*(NIP|PESEL|KRS|REGON)\s*[:.]?\s*/i, '').trim()
}

function normalizeParty(p: IntakeParty): IntakeParty {
  return { ...p, idNumber: cleanId(p.idNumber ?? ''), name: (p.name ?? '').trim() }
}

export async function sendIntake(messages: ChatMessage[], state: IntakeState, savedOwnParty?: SavedParty): Promise<IntakeResult> {
  const catalog = TEMPLATES.map((t) => ({ id: t.id, name: t.name, roles: t.roles, category: getCategory(t.category).short }))
  let r: Response
  try {
    r = await fetch('/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catalog, messages: messages.map((m) => ({ role: m.role, text: m.text })), state, savedOwnParty: savedOwnParty ?? null }),
    })
  } catch {
    throw new IntakeError('Brak połączenia z serwerem.', 'network')
  }
  const data = await r.json().catch(() => null)
  if (!r.ok || !data?.result) throw new IntakeError(data?.error ?? 'Nie udało się przetworzyć wiadomości.', data?.code ?? 'unknown')
  const res = data.result as IntakeResult
  const tpl = getTemplate(res.templateId)
  return {
    ...res,
    templateId: tpl ? tpl.id : '',
    partyA: normalizeParty(res.partyA),
    partyB: normalizeParty(res.partyB),
    ready: !!tpl && res.ready,
    quickReplies: (res.quickReplies ?? []).slice(0, 4),
  }
}

export function ownPartyOf(s: IntakeState): IntakeParty | null {
  if (!s.myRole) return null
  return s.myRole === 'A' ? s.partyA : s.partyB
}

/** Czy dane użytkownika z rozmowy różnią się od zapisanych w profilu (warto zapytać o zapis). */
export function ownDataDiffers(own: IntakeParty | null, saved?: SavedParty): boolean {
  if (!own || !own.name || !(own.address || own.idNumber)) return false
  if (!saved) return true
  return own.name !== saved.name || own.address !== saved.address || own.idNumber !== saved.idNumber
}

export function toSavedParty(p: IntakeParty): SavedParty {
  return { kind: p.kind || 'firma', name: p.name, address: p.address, idNumber: p.idNumber, email: p.email, representative: p.representative }
}

function pick<T extends string>(v: string, options: T[], fallback: T): T {
  return (options as string[]).includes(v) ? (v as T) : fallback
}

export function toWizardAnswers(s: IntakeState): WizardAnswers {
  const a = s.answers
  return {
    ...DEFAULT_ANSWERS,
    scope: a.scope,
    amount: a.amount.replace(/[^\d.,]/g, ''),
    amountBasis: a.amountBasis || DEFAULT_ANSWERS.amountBasis,
    paymentDays: a.paymentDays.replace(/\D/g, '') || DEFAULT_ANSWERS.paymentDays,
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(a.startDate) ? a.startDate : '',
    endDate: /^\d{4}-\d{2}-\d{2}$/.test(a.endDate) ? a.endDate : '',
    deposit: a.deposit.replace(/[^\d.,]/g, ''),
    liability: pick(a.liability, LIABILITY_OPTIONS, DEFAULT_ANSWERS.liability),
    notice: pick(a.notice, NOTICE_OPTIONS, DEFAULT_ANSWERS.notice),
    ip: pick(a.ip, IP_OPTIONS, DEFAULT_ANSWERS.ip),
    penalty: pick(a.penalty, PENALTY_OPTIONS, DEFAULT_ANSWERS.penalty),
    confidentiality: a.confidentiality ? a.confidentiality === 'tak' : DEFAULT_ANSWERS.confidentiality,
    extra: a.extra,
  }
}

export function toParties(s: IntakeState): [Party, Party] {
  const t = getTemplate(s.templateId)!
  const mk = (id: PartyId, p: IntakeParty, i: 0 | 1): Party => ({
    id,
    role: t.roles[i],
    kind: p.kind || t.defaultKinds[i],
    name: p.name,
    address: p.address,
    idNumber: p.idNumber,
    email: p.email,
    representative: p.representative,
  })
  return [mk('A', s.partyA, 0), mk('B', s.partyB, 1)]
}

export function buildContractFromIntake(s: IntakeState, authorName: string): Contract {
  const t = getTemplate(s.templateId)!
  const parties = toParties(s)
  const clauses = generateClauses(t, parties, toWizardAnswers(s))
  const at = nowIso()
  const owner: PartyId = s.myRole || 'A'
  return {
    id: uid('k'),
    title: s.title.trim() || t.name,
    templateId: t.id,
    source: 'template',
    createdAt: at,
    updatedAt: at,
    stage: 'draft',
    ownerPartyId: owner,
    parties,
    clauses,
    proposals: [],
    comments: [],
    versions: [{ id: uid('v'), number: 1, createdAt: at, authorName, note: 'Utworzono projekt z opisu', clauses: clauses.map((c) => ({ ...c })) }],
    signatures: [],
    acceptedBy: {},
    privateChats: {},
    activity: [{ id: uid('a'), at, text: `${authorName} utworzył(a) projekt umowy z opisu`, partyId: owner }],
  }
}

/** Zapisuje stan do kreatora krok po kroku (otwiera się na kroku z projektem). */
export function seedWizard(s: IntakeState): string {
  const t = getTemplate(s.templateId)!
  const draft = { step: 2, myRole: s.myRole || null, parties: toParties(s), answers: toWizardAnswers(s), clauses: null, title: s.title || t.name }
  try {
    localStorage.setItem(`prawoai:wizard:${t.id}`, JSON.stringify(draft))
  } catch {
    /* ignoruj */
  }
  return `/wzory/${t.id}`
}

/** Bez modelu AI: dopasowanie wzoru po słowach kluczowych. */
export function guessTemplate(text: string): string | null {
  const q = text.toLowerCase()
  const rules: [RegExp, string][] = [
    [/zleceni/, 'zlecenie'],
    [/dzieł/, 'dzielo'],
    [/najm\w* (pokoj|pokój)/, 'najem-pokoju'],
    [/najm|wynaj/, 'najem-mieszkania'],
    [/nda|poufno/, 'nda-wzajemna'],
    [/pożycz/, 'pozyczka'],
    [/samoch|auto\b/, 'sprzedaz-samochodu'],
    [/sprzeda/, 'sprzedaz-rzeczy'],
    [/ugod/, 'ugoda'],
    [/b2b|współprac/, 'wspolpraca-b2b'],
    [/usług/, 'uslugi-b2b'],
    [/wspólnik/, 'umowa-wspolnikow'],
    [/licencj/, 'licencja-niewylaczna'],
    [/remont/, 'remont'],
  ]
  return rules.find(([re]) => re.test(q))?.[1] ?? null
}

/** Skróty na stronie głównej. */
export const QUICK_STARTS: { label: string; prompt: string }[] = [
  { label: 'Umowa zlecenia', prompt: 'Chcę utworzyć umowę zlecenia.' },
  { label: 'Umowa o dzieło', prompt: 'Chcę utworzyć umowę o dzieło.' },
  { label: 'Współpraca B2B', prompt: 'Chcę utworzyć umowę o współpracy B2B.' },
  { label: 'Najem mieszkania', prompt: 'Chcę utworzyć umowę najmu mieszkania.' },
  { label: 'NDA', prompt: 'Chcę utworzyć umowę o zachowaniu poufności (NDA).' },
  { label: 'Pożyczka', prompt: 'Chcę utworzyć umowę pożyczki.' },
  { label: 'Sprzedaż samochodu', prompt: 'Chcę utworzyć umowę sprzedaży samochodu.' },
]
