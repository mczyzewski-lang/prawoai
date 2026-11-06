import type { ChatMessage, Clause, Contract, GrammarForm, MyTemplate, Party, PartyId, PartyKind, SavedParty } from '../types'
import { TEMPLATES, getCategory, getTemplate } from '../data/templates'
import { DEFAULT_ANSWERS, generateClauses, partyLine, IP_OPTIONS, LIABILITY_OPTIONS, NOTICE_OPTIONS, PENALTY_OPTIONS, type WizardAnswers } from './contractGenerator'
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
  /** Tworzenie z własnego wzoru użytkownika. */
  myTemplateId?: string
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

export async function sendIntake(
  messages: ChatMessage[],
  state: IntakeState,
  savedOwnParty?: SavedParty,
  extras: { persona?: { addressAs: string; form: GrammarForm }; myTemplate?: MyTemplate } = {},
): Promise<IntakeResult> {
  const mt = extras.myTemplate
  const myTemplate = mt
    ? { name: mt.name, templateId: mt.templateId ?? '', myRole: mt.ownerPartyId, myRoleName: mt.parties.find((p) => p.id === mt.ownerPartyId)?.role, otherRoleName: mt.parties.find((p) => p.id !== mt.ownerPartyId)?.role }
    : undefined
  const catalog = TEMPLATES.map((t) => ({ id: t.id, name: t.name, roles: t.roles, category: getCategory(t.category).short }))
  let r: Response
  try {
    r = await fetch('/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catalog, messages: messages.map((m) => ({ role: m.role, text: m.text })), state, savedOwnParty: savedOwnParty ?? null, persona: extras.persona, myTemplate }),
    })
  } catch {
    throw new IntakeError('Brak połączenia z serwerem.', 'network')
  }
  const data = await r.json().catch(() => null)
  if (!r.ok || !data?.result) throw new IntakeError(data?.error ?? 'Nie udało się przetworzyć wiadomości.', data?.code ?? 'unknown')
  const res = data.result as IntakeResult
  if (mt) {
    // Własny wzór: rola i dane użytkownika pochodzą ze wzoru, model uzupełnia drugą stronę.
    const own = mt.parties.find((p) => p.id === mt.ownerPartyId)!
    const ownIntake: IntakeParty = { kind: own.kind, name: own.name, address: own.address, idNumber: own.idNumber, email: own.email, representative: own.representative }
    const other = normalizeParty(mt.ownerPartyId === 'A' ? res.partyB : res.partyA)
    return {
      ...res,
      templateId: mt.templateId ?? '',
      myTemplateId: mt.id,
      myRole: mt.ownerPartyId,
      partyA: mt.ownerPartyId === 'A' ? ownIntake : other,
      partyB: mt.ownerPartyId === 'B' ? ownIntake : other,
      ready: !!other.name,
      quickReplies: (res.quickReplies ?? []).slice(0, 4),
    }
  }
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
  return `/wzory/${t.id}/kreator`
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


/** Umowa z własnego wzoru: podmienia dane drugiej strony w treści zapisów. */
export function buildContractFromMyTemplate(mt: MyTemplate, s: IntakeState, authorName: string): Contract {
  const otherId: PartyId = mt.ownerPartyId === 'A' ? 'B' : 'A'
  const oldOther = mt.parties.find((p) => p.id === otherId)!
  const src = otherId === 'A' ? s.partyA : s.partyB
  const newOther: Party = { ...oldOther, kind: src.kind || oldOther.kind, name: src.name, address: src.address, idNumber: src.idNumber, email: src.email, representative: src.representative }
  const parties = mt.parties.map((p) => (p.id === otherId ? newOther : { ...p })) as [Party, Party]
  const swaps: [string, string][] = (['name', 'address', 'idNumber', 'email', 'representative'] as const)
    .map((k) => [oldOther[k], newOther[k]] as [string, string])
    .filter(([a, b]) => a && a.length > 2 && b && a !== b)
    .sort((x, y) => y[0].length - x[0].length)
  const clauses: Clause[] = mt.clauses.map((cl, i) => {
    let text = cl.text
    if (i === 0 && text.startsWith('Umowa zostaje zawarta pomiędzy')) {
      const [A, B] = parties
      text = `Umowa zostaje zawarta pomiędzy:\n1) ${partyLine(A)},\n2) ${partyLine(B)},\nzwanymi dalej łącznie „Stronami”.`
    } else for (const [a, b] of swaps) text = text.split(a).join(b)
    return { ...cl, id: uid('cl'), text }
  })
  const at = nowIso()
  const title = s.title.trim() || `${mt.name} – ${newOther.name}`
  return {
    id: uid('k'),
    title,
    templateId: mt.templateId,
    source: 'template',
    createdAt: at,
    updatedAt: at,
    stage: 'draft',
    ownerPartyId: mt.ownerPartyId,
    parties,
    clauses,
    proposals: [],
    comments: [],
    versions: [{ id: uid('v'), number: 1, createdAt: at, authorName, note: `Utworzono z wzoru „${mt.name}”`, clauses: clauses.map((c) => ({ ...c })) }],
    signatures: [],
    acceptedBy: {},
    privateChats: {},
    activity: [{ id: uid('a'), at, text: `${authorName} utworzył(a) umowę z własnego wzoru „${mt.name}”`, partyId: mt.ownerPartyId }],
  }
}

/** Zapisuje umowę jako własny wzór. */
export function toMyTemplate(c: Contract, name: string): MyTemplate {
  return { id: uid('mt'), name: name.trim() || c.title, createdAt: nowIso(), templateId: c.templateId, ownerPartyId: c.ownerPartyId, parties: c.parties.map((p) => ({ ...p })) as [Party, Party], clauses: c.clauses.map((x) => ({ ...x })) }
}


const LEGAL_WORDS = /^(sp|spółka|z|o\.?o\.?|s\.?a\.?|s\.?c\.?|sp\.?k\.?|ul|al|i|oraz)$/i

/** Wzorce (z tolerancją na odmianę) wykrywające dane poprzedniego kontrahenta w treści. */
function partyPatterns(p: Party): { label: string; re: RegExp }[] {
  const out: { label: string; re: RegExp }[] = []
  const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const words = p.name.split(/\s+/).map((w) => w.replace(/[„”"(),.]/g, '')).filter((w) => w.length >= 2 && !LEGAL_WORDS.test(w))
  for (let i = 0; i < words.length - 1; i++) {
    const stem = (w: string) => esc(w.length > 4 ? w.slice(0, w.length - 2) : w.slice(0, Math.max(2, w.length - 1)))
    out.push({ label: `${words[i]} ${words[i + 1]}`, re: new RegExp(`${stem(words[i])}\\p{L}*\\s+${stem(words[i + 1])}\\p{L}*`, 'iu') })
  }
  if (words.length === 1 && words[0].length >= 4) out.push({ label: words[0], re: new RegExp(`${esc(words[0].slice(0, -1))}\\p{L}*`, 'iu') })
  for (const v of [p.address, p.idNumber, p.email]) if (v && v.length >= 5) out.push({ label: v, re: new RegExp(esc(v), 'i') })
  return out
}

/** Zapisy, w których wciąż występują dane podanej strony. */
export function findPartyMentions(clauses: Clause[], p: Party): { index: number; label: string }[] {
  const pats = partyPatterns(p)
  const hits: { index: number; label: string }[] = []
  clauses.forEach((c, index) => {
    const hit = pats.find((x) => x.re.test(c.text))
    if (hit) hits.push({ index, label: hit.label })
  })
  return hits
}

/**
 * Dostosowuje umowę z własnego wzoru do nowego kontrahenta:
 * model AI przeredagowuje zapisy z odniesieniami do poprzedniej strony (z poprawną odmianą),
 * a ewentualne pozostałości są zgłaszane do sprawdzenia.
 */
export async function retargetMyTemplateContract(c: Contract, mt: MyTemplate, useAi: boolean): Promise<Contract> {
  const otherId: PartyId = mt.ownerPartyId === 'A' ? 'B' : 'A'
  const oldOther = mt.parties.find((p) => p.id === otherId)!
  const newOther = c.parties.find((p) => p.id === otherId)!
  let clauses = c.clauses
  const mentions = findPartyMentions(clauses, oldOther)
  if (useAi && mentions.length) {
    try {
      const r = await fetch('/api/retarget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldParty: { name: oldOther.name, address: oldOther.address, idNumber: oldOther.idNumber, email: oldOther.email, representative: oldOther.representative, role: oldOther.role },
          newParty: { name: newOther.name, address: newOther.address, idNumber: newOther.idNumber, email: newOther.email, representative: newOther.representative, role: newOther.role },
          clauses: mentions.map((m) => ({ index: m.index, text: clauses[m.index].text })),
        }),
      })
      const data = await r.json()
      for (const e of (data?.result?.clauses ?? []) as { index: number; text: string }[]) {
        if (clauses[e.index] && e.text?.trim()) clauses = clauses.map((cl, i) => (i === e.index ? { ...cl, text: e.text.trim() } : cl))
      }
    } catch {
      /* zostaw podstawienia, zgłosimy pozostałości */
    }
  }
  const left = findPartyMentions(clauses, oldOther)
  const reviewNotice = left.length
    ? `W treści mogą nadal występować dane poprzedniego kontrahenta (${Array.from(new Set(left.map((l) => `„${l.label}”`))).join(', ')}) – sprawdź ${left.map((l) => `§ ${l.index + 1}`).join(', ')}.`
    : undefined
  return { ...c, clauses, versions: c.versions.map((v, i) => (i === 0 ? { ...v, clauses: clauses.map((x) => ({ ...x })) } : v)), reviewNotice }
}
