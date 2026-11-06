import type { ChatMessage, Clause, Contract, DataCollection, GrammarForm, Party, PartyId, SavedParty } from '../types'
import { rowDetails, rowToParty } from './dataBook'
import { partyLine } from './contractGenerator'
import { snapshot, submitProposal } from './contractOps'
import { partiesClauseIsGenerated } from './documentFormat'
import { nowIso, uid } from './utils'

/**
 * Asystent AI w umowie: rozmowa + edycja treści (serwer /api/contract-chat).
 * W szkicu zmiany wchodzą od razu (z możliwością cofnięcia), po udostępnieniu – jako propozycje do akceptacji.
 */

export interface AssistantEdit {
  op: 'update' | 'insert' | 'delete'
  index: number
  title: string
  text: string
  summary: string
}

export interface AssistantResult {
  reply: string
  edits: AssistantEdit[]
  partyUpdates: (SavedParty & { partyId: PartyId; kind: SavedParty['kind'] | '' })[]
  title: string
  quickReplies: string[]
}

export interface Mention {
  label: string
  /** Osoba lub firma (strona umowy). */
  data?: SavedParty
  /** Inne dane z „Adresy i dane” (np. sprzęt): nazwa kolekcji i wartości kolumn. */
  info?: { collection: string; values: { label: string; value: string }[] }
}

export class AssistantError extends Error {}

export async function askContractAssistant(
  c: Contract,
  viewer: PartyId,
  messages: ChatMessage[],
  opts: { persona?: { addressAs: string; form: GrammarForm }; mentions?: Mention[] } = {},
): Promise<AssistantResult> {
  let r: Response
  try {
    r = await fetch('/api/contract-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contract: { title: c.title, parties: c.parties, clauses: c.clauses.map((x) => ({ title: x.title, text: x.text })) },
        viewer,
        stage: c.stage === 'draft' ? 'draft' : 'shared',
        messages: messages.map((m) => ({ role: m.role, text: m.text })),
        persona: opts.persona,
        mentions: opts.mentions?.map((m) => (m.data ? { label: m.label, ...m.data } : { label: m.label, kolekcja: m.info?.collection, dane: Object.fromEntries((m.info?.values ?? []).map((v) => [v.label, v.value])) })),
      }),
    })
  } catch {
    throw new AssistantError('Brak połączenia z serwerem.')
  }
  const data = await r.json().catch(() => null)
  if (!r.ok || !data?.result) throw new AssistantError(data?.error ?? 'Asystent nie odpowiedział. Spróbuj ponownie.')
  return data.result as AssistantResult
}

function regenPartiesClause(c: Contract, parties: [Party, Party], clauses: Clause[]): Clause[] {
  if (!partiesClauseIsGenerated(c, clauses[0])) return clauses
  return clauses.map((cl, i) => (i === 0 ? { ...cl, text: `Umowa zostaje zawarta pomiędzy:\n1) ${partyLine(parties[0])},\n2) ${partyLine(parties[1])},\nzwanymi dalej łącznie „Stronami”.` } : cl))
}

function mergeParty(p: Party, u: AssistantResult['partyUpdates'][number]): Party {
  const pick = (a: string, b: string) => (b && b.trim() ? b.trim() : a)
  return {
    ...p,
    kind: u.kind || p.kind,
    name: pick(p.name, u.name),
    address: pick(p.address, u.address),
    idNumber: pick(p.idNumber, u.idNumber).replace(/^\s*(NIP|PESEL|KRS)\s*[:.]?\s*/i, ''),
    email: pick(p.email, u.email),
    representative: pick(p.representative, u.representative),
  }
}

/** Nanosi zmiany asystenta. Zwraca nową umowę, listę zmienionych zapisów i dane do cofnięcia. */
export function applyAssistantResult(c: Contract, res: AssistantResult, viewer: PartyId, actorName: string): { contract: Contract; changes: { clauseId: string; label: string }[]; undo?: ChatMessage['undo'] } {
  const edits = (res.edits ?? []).filter((e) => (e.op === 'insert' ? e.index >= -1 && e.index < c.clauses.length : e.index >= 0 && e.index < c.clauses.length))
  const partyUpdates = (res.partyUpdates ?? []).filter((u) => u.partyId === 'A' || u.partyId === 'B')
  const newTitle = res.title?.trim()
  if (!edits.length && !partyUpdates.length && !newTitle) return { contract: c, changes: [] }

  const draft = c.stage === 'draft'
  let parties = c.parties.map((p) => {
    const u = partyUpdates.find((x) => x.partyId === p.id)
    // Po udostępnieniu asystent zmienia tylko dane własnej strony.
    return u && (draft || p.id === viewer) ? mergeParty(p, u) : p
  }) as [Party, Party]

  if (draft) {
    const updates = new Map(edits.filter((e) => e.op === 'update').map((e) => [e.index, e]))
    const deletes = new Set(edits.filter((e) => e.op === 'delete').map((e) => e.index))
    const inserts = (i: number) => edits.filter((e) => e.op === 'insert' && e.index === i).map((e) => ({ id: uid('cl'), title: e.title.trim() || 'Nowy zapis', text: e.text.trim() }) as Clause)
    const touched = new Set<string>()
    let clauses: Clause[] = [...inserts(-1)]
    clauses.forEach((x) => touched.add(x.id))
    c.clauses.forEach((cl, i) => {
      if (!deletes.has(i)) {
        const u = updates.get(i)
        if (u && u.text.trim() && u.text.trim() !== cl.text) {
          clauses.push({ ...cl, text: u.text.trim(), title: u.title.trim() || cl.title })
          touched.add(cl.id)
        } else clauses.push(cl)
      }
      for (const n of inserts(i)) {
        clauses.push(n)
        touched.add(n.id)
      }
    })
    const before = clauses
    clauses = regenPartiesClause(c, parties, clauses)
    if (clauses[0] && before[0] && clauses[0].text !== before[0].text) touched.add(clauses[0].id)
    const notes = [...edits.map((e) => e.summary).filter(Boolean), ...(partyUpdates.length ? ['Uzupełniono dane stron'] : [])]
    const undo = { clauses: c.clauses.map((x) => ({ ...x })), parties: c.parties.map((p) => ({ ...p })) as [Party, Party], title: c.title }
    // Tytuł „Wzór – Stara nazwa” podąża za nową nazwą drugiej strony.
    let title = newTitle || c.title
    if (!newTitle) {
      for (const p of c.parties) {
        const np = parties.find((x) => x.id === p.id)
        if (p.name && np?.name && np.name !== p.name && title.endsWith(` – ${p.name}`)) title = title.slice(0, -p.name.length) + np.name
      }
    }
    let next: Contract = { ...c, clauses, parties, title }
    next = snapshot(next, `${actorName} (z asystentem)`, `Asystent: ${notes.join('; ') || 'zmiany w umowie'}`)
    next = { ...next, activity: [...next.activity, { id: uid('a'), at: nowIso(), text: `${actorName} wprowadził(a) zmiany z asystentem: ${notes.join('; ')}`, partyId: viewer }] }
    const changes = clauses.map((cl, i) => ({ cl, i })).filter(({ cl }) => touched.has(cl.id)).map(({ cl, i }) => ({ clauseId: cl.id, label: `§ ${i + 1} ${cl.title}` }))
    return { contract: next, changes, undo }
  }

  // Umowa udostępniona: propozycje do akceptacji drugiej strony.
  let next: Contract = { ...c, parties }
  const before = new Set(c.proposals.map((p) => p.id))
  const changes: { clauseId: string; label: string }[] = []
  for (const e of edits) {
    if (e.op === 'update') {
      const cl = next.clauses[e.index]
      if (!cl || !e.text.trim() || e.text.trim() === cl.text) continue
      next = submitProposal(next, { clauseId: cl.id, newText: e.text.trim(), comment: e.summary, partyId: viewer, authorName: actorName })
      changes.push({ clauseId: cl.id, label: `§ ${e.index + 1} ${cl.title} (propozycja)` })
    } else if (e.op === 'insert') {
      const newClause: Clause = { id: uid('cl'), title: e.title.trim() || 'Nowy zapis', text: '(nowy zapis – oczekuje na akceptację)' }
      const at = e.index + 1
      next = { ...next, clauses: [...next.clauses.slice(0, at), newClause, ...next.clauses.slice(at)] }
      next = submitProposal(next, { clauseId: newClause.id, newText: e.text.trim(), comment: e.summary, partyId: viewer, authorName: actorName })
      changes.push({ clauseId: newClause.id, label: `§ ${at + 1} ${newClause.title} (propozycja)` })
    }
  }
  const proposalIds = next.proposals.filter((p) => !before.has(p.id)).map((p) => p.id)
  return { contract: next, changes, undo: proposalIds.length ? { proposalIds } : undefined }
}

/** Kontakty do @wzmianek: zapisane dane użytkownika i strony z jego umów. */
export function collectContacts(profileOwn: SavedParty | undefined, contracts: Contract[], dataBook: DataCollection[] = []): Mention[] {
  const out: Mention[] = []
  const seen = new Set<string>()
  const add = (data: SavedParty) => {
    const key = data.name.trim().toLowerCase()
    if (!key || key.length < 3 || seen.has(key) || /^strona (pierwsza|druga)$|^\[/i.test(key) || /nie wskazano/i.test(key)) return
    seen.add(key)
    out.push({ label: data.name.trim(), data })
  }
  if (profileOwn) add(profileOwn)
  // Baza „Adresy i dane”: osoby jako strony umowy, pozostałe kolekcje jako dane do wpisania.
  for (const col of dataBook) {
    for (const r of col.rows) {
      const label = r.label.trim()
      if (!label || seen.has(label.toLowerCase())) continue
      if (col.kind === 'osoby') {
        seen.add(label.toLowerCase())
        out.push({ label, data: rowToParty(r) })
      } else {
        seen.add(label.toLowerCase())
        out.push({ label, info: { collection: col.name, values: rowDetails(col, r) } })
      }
    }
  }
  for (const c of contracts) for (const p of c.parties) add({ kind: p.kind, name: p.name, address: p.address, idNumber: p.idNumber, email: p.email, representative: p.representative })
  return out
}

/** Zamienia „@Nazwa” na nazwę z danymi (adres, NIP/PESEL…), aby generator mógł je wpisać do umowy. */
export function expandMentions(text: string, contacts: Mention[]): string {
  const sorted = [...contacts].sort((a, b) => b.label.length - a.label.length)
  let out = text
  for (const c of sorted) {
    if (!c.data) {
      const vals = c.info?.values ?? []
      const full = vals.length ? `${c.label} (${vals.map((v) => `${v.label}: ${v.value}`).join('; ')})` : c.label
      out = out.split(`@${c.label}`).join(full)
      continue
    }
    const d = c.data
    const details = [
      d.address && `adres: ${d.address}`,
      d.idNumber && `${d.kind === 'firma' ? 'NIP/KRS' : 'PESEL'}: ${d.idNumber}`,
      d.kind === 'firma' && d.representative && `reprezentowana przez: ${d.representative}`,
      d.email && `e-mail: ${d.email}`,
    ].filter(Boolean)
    const full = details.length ? `${c.label} (${d.kind === 'firma' ? 'firma' : 'osoba fizyczna'}; ${details.join(', ')})` : c.label
    out = out.split(`@${c.label}`).join(full)
  }
  return out
}

/** Podpis w liście podpowiedzi „@”. */
export function mentionSubtitle(m: Mention): string {
  if (m.data) return [m.data.address, m.data.idNumber].filter(Boolean).join(' · ') || (m.data.kind === 'firma' ? 'firma' : 'osoba')
  return [m.info?.collection, ...(m.info?.values ?? []).slice(0, 2).map((v) => v.value)].filter(Boolean).join(' · ')
}
