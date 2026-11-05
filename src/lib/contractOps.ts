import type { Clause, Contract, Finding, PartyId, Proposal, Signature } from '../types'
import { nowIso, otherParty, uid } from './utils'

/** Czyste funkcje modyfikujące umowę. Każda zwraca nowy obiekt. */

function log(c: Contract, text: string, partyId?: PartyId): Contract {
  const at = nowIso()
  return { ...c, updatedAt: at, activity: [...c.activity, { id: uid('a'), at, text, partyId }] }
}

export function snapshot(c: Contract, authorName: string, note: string): Contract {
  const v = { id: uid('v'), number: c.versions.length + 1, createdAt: nowIso(), authorName, note, clauses: c.clauses.map((x) => ({ ...x })) }
  return { ...c, versions: [...c.versions, v], acceptedBy: {} }
}

export function currentVersion(c: Contract): number {
  return c.versions.length
}

/** Bezpośrednia edycja (tylko szkic, przed udostępnieniem). */
export function editDraftClauses(c: Contract, clauses: Clause[], authorName: string): Contract {
  return log(snapshot({ ...c, clauses }, authorName, 'Edycja projektu'), `${authorName} zapisał(a) zmiany w projekcie`)
}

export function shareContract(c: Contract, invite: { name: string; email: string; message: string }, authorName: string): Contract {
  const shareId = c.shareId ?? uid('s').replace('s_', '')
  const other = otherParty(c.ownerPartyId)
  const parties = c.parties.map((p) =>
    p.id === other && invite.email && !p.email ? { ...p, email: invite.email } : p,
  ) as Contract['parties']
  const next: Contract = {
    ...c,
    parties,
    shareId,
    stage: c.stage === 'draft' ? 'shared' : c.stage,
    invite: { ...invite, sentAt: nowIso() },
  }
  return log(next, `${authorName} udostępnił(a) dokument: ${invite.name || invite.email}`, c.ownerPartyId)
}

export function submitProposal(
  c: Contract,
  p: { clauseId: string; newText: string; comment: string; partyId: PartyId; authorName: string },
): Contract {
  const clause = c.clauses.find((x) => x.id === p.clauseId)
  if (!clause) return c
  const proposal: Proposal = {
    id: uid('p'),
    clauseId: p.clauseId,
    authorPartyId: p.partyId,
    authorName: p.authorName,
    originalText: clause.text,
    newText: p.newText,
    comment: p.comment,
    status: 'open',
    createdAt: nowIso(),
  }
  const next = { ...c, proposals: [...c.proposals, proposal], acceptedBy: {}, stage: c.stage === 'draft' ? c.stage : ('shared' as const) }
  return log(next, `${p.authorName} zaproponował(a) zmianę: „${clause.title}”`, p.partyId)
}

export function resolveProposal(c: Contract, proposalId: string, decision: 'accepted' | 'rejected' | 'withdrawn', actor: { partyId: PartyId; name: string }): Contract {
  const prop = c.proposals.find((p) => p.id === proposalId)
  if (!prop || prop.status !== 'open') return c
  if (decision === 'withdrawn' && prop.authorPartyId !== actor.partyId) return c
  if (decision !== 'withdrawn' && prop.authorPartyId === actor.partyId) return c
  const resolved: Proposal = { ...prop, status: decision, resolvedAt: nowIso(), resolvedByName: actor.name }
  let next: Contract = { ...c, proposals: c.proposals.map((p) => (p.id === proposalId ? resolved : p)) }
  const clause = c.clauses.find((x) => x.id === prop.clauseId)
  const title = clause?.title ?? 'zapis'
  if (decision === 'accepted') {
    next = { ...next, clauses: next.clauses.map((x) => (x.id === prop.clauseId ? { ...x, text: prop.newText } : x)) }
    // Inne otwarte propozycje do tego samego zapisu odnoszą się do nieaktualnego brzmienia – zostają, ale z adnotacją w historii.
    next = snapshot(next, actor.name, `Przyjęto zmianę: „${title}” (autor: ${prop.authorName})`)
  }
  const verb = decision === 'accepted' ? 'zaakceptował(a)' : decision === 'rejected' ? 'odrzucił(a)' : 'wycofał(a)'
  return log(next, `${actor.name} ${verb} propozycję: „${title}”`, actor.partyId)
}

export function addComment(c: Contract, cm: { clauseId: string | null; text: string; partyId: PartyId; authorName: string }): Contract {
  const next = {
    ...c,
    comments: [...c.comments, { id: uid('c'), clauseId: cm.clauseId, authorPartyId: cm.partyId, authorName: cm.authorName, text: cm.text, createdAt: nowIso() }],
  }
  return log(next, `${cm.authorName} dodał(a) komentarz`, cm.partyId)
}

export function acceptCurrentVersion(c: Contract, partyId: PartyId, name: string): Contract {
  const version = currentVersion(c)
  const acceptedBy = { ...c.acceptedBy, [partyId]: { at: nowIso(), version } }
  const openCount = c.proposals.filter((p) => p.status === 'open').length
  const both = acceptedBy.A?.version === version && acceptedBy.B?.version === version
  let next: Contract = { ...c, acceptedBy }
  next = log(next, `${name} zaakceptował(a) wersję ${version}`, partyId)
  if (both && openCount === 0) next = log({ ...next, stage: 'agreed' }, 'Obie strony uzgodniły treść umowy')
  return next
}

export function revokeAcceptance(c: Contract, partyId: PartyId, name: string): Contract {
  const acceptedBy = { ...c.acceptedBy }
  delete acceptedBy[partyId]
  return log({ ...c, acceptedBy, stage: c.stage === 'agreed' ? 'shared' : c.stage }, `${name} wycofał(a) akceptację`, partyId)
}

export function addSignature(c: Contract, sig: Signature): Contract {
  const signatures = [...c.signatures.filter((s) => s.partyId !== sig.partyId), sig]
  let next: Contract = log({ ...c, signatures }, `${sig.signerName} złożył(a) podpis`, sig.partyId)
  if (signatures.length === 2) next = log({ ...next, stage: 'signed' }, 'Umowa została podpisana przez obie strony')
  return next
}

export function removeSignature(c: Contract, partyId: PartyId): Contract {
  const sig = c.signatures.find((s) => s.partyId === partyId)
  if (!sig || c.stage === 'signed') return c
  return log({ ...c, signatures: c.signatures.filter((s) => s.partyId !== partyId) }, `${sig.signerName} usunął(-ęła) podpis`, partyId)
}

/** Decyzja użytkownika co do uwagi z analizy. Zmiana treści następuje wyłącznie po akceptacji. */
export function decideFinding(c: Contract, findingId: string, decision: 'accept' | 'reject' | 'edit' | 'reset', authorName: string, editedText?: string): Contract {
  if (!c.analysis) return c
  const f = c.analysis.findings.find((x) => x.id === findingId)
  if (!f) return c
  const updateFinding = (patch: Partial<Finding>) => ({
    ...c.analysis!,
    findings: c.analysis!.findings.map((x) => (x.id === findingId ? { ...x, ...patch } : x)),
  })
  if (decision === 'reject') return log({ ...c, analysis: updateFinding({ status: 'rejected' }) }, `Odrzucono sugestię: „${f.title}”`)
  if (decision === 'reset') return { ...c, analysis: updateFinding({ status: 'pending', editedText: undefined }) }

  const text = decision === 'edit' ? (editedText ?? f.suggestion) : f.suggestion
  const isDraft = c.stage === 'draft'
  let clauses = c.clauses
  let newClauseId = f.clauseId
  if (f.clauseId) {
    const cl = c.clauses.find((x) => x.id === f.clauseId)
    if (!cl) return c
    const newText = f.excerpt && cl.text.includes(f.excerpt) ? cl.text.replace(f.excerpt, text) : `${cl.text}\n${text}`
    if (isDraft) clauses = c.clauses.map((x) => (x.id === f.clauseId ? { ...x, text: newText } : x))
    else {
      // Po udostępnieniu – zamiast zmieniać treść, tworzymy propozycję do akceptacji przez drugą stronę.
      const next = submitProposal(c, { clauseId: cl.id, newText, comment: f.title, partyId: c.ownerPartyId, authorName })
      return { ...next, analysis: { ...updateFinding({ status: decision === 'edit' ? 'edited' : 'accepted', editedText: decision === 'edit' ? text : undefined }) } }
    }
  } else {
    const newClause: Clause = { id: uid('cl'), title: f.excerpt ?? f.title, text }
    newClauseId = newClause.id
    const finalIdx = c.clauses.findIndex((x) => /końcow/i.test(x.title))
    clauses = finalIdx >= 0 ? [...c.clauses.slice(0, finalIdx), newClause, ...c.clauses.slice(finalIdx)] : [...c.clauses, newClause]
    if (!isDraft) {
      // Nowy zapis po udostępnieniu: dodajemy pusty zapis + propozycję treści.
      const withEmpty = { ...c, clauses: clauses.map((x) => (x.id === newClause.id ? { ...x, text: '(nowy zapis – oczekuje na akceptację)' } : x)) }
      const next = submitProposal(withEmpty, { clauseId: newClause.id, newText: text, comment: f.title, partyId: c.ownerPartyId, authorName })
      return { ...next, analysis: { ...updateFinding({ status: decision === 'edit' ? 'edited' : 'accepted', editedText: decision === 'edit' ? text : undefined, clauseId: newClauseId }) } }
    }
  }
  const next = snapshot({ ...c, clauses }, authorName, `Wprowadzono sugestię: „${f.title}”`)
  return log(
    { ...next, analysis: { ...updateFinding({ status: decision === 'edit' ? 'edited' : 'accepted', editedText: decision === 'edit' ? text : undefined, clauseId: newClauseId }) } },
    `Wprowadzono sugestię: „${f.title}”`,
  )
}
