import type { Clause, Contract, Party } from '../types'
import { getTemplate } from '../data/templates'

/** Czy zapis jest zapisem o stronach (wyświetlany jako dwie kolumny). */
export function isPartiesClause(c: Contract, index: number): boolean {
  if (index !== 0) return false
  const cl = c.clauses[0]
  return !!cl && /stron|wstęp|preambu/i.test(cl.title)
}

export type LineKind = 'num' | 'letter' | 'bullet' | 'para' | 'blank'

export interface ClauseLine {
  kind: LineKind
  marker: string
  content: string
  /** Pozycja `content` w pełnej treści zapisu (do zakreśleń). */
  offset: number
  length: number
}

/** Dzieli treść zapisu na ustępy: „1.”, „a)”, punktory i zwykłe akapity. */
export function splitClauseLines(text: string): ClauseLine[] {
  const out: ClauseLine[] = []
  let pos = 0
  for (const raw of text.split('\n')) {
    const start = pos
    pos += raw.length + 1
    if (!raw.trim()) {
      out.push({ kind: 'blank', marker: '', content: '', offset: start, length: 0 })
      continue
    }
    const m = raw.match(/^(\s*)(\d{1,2}[.)]|[a-z][.)]|[-–•])(\s+)/)
    if (m) {
      const marker = m[2]
      const kind: LineKind = /^\d/.test(marker) ? 'num' : /^[a-z]/.test(marker) ? 'letter' : 'bullet'
      const prefix = m[0].length
      out.push({ kind, marker: kind === 'bullet' ? '•' : marker, content: raw.slice(prefix), offset: start + prefix, length: raw.length - prefix })
    } else {
      const lead = raw.length - raw.trimStart().length
      out.push({ kind: 'para', marker: '', content: raw.slice(lead), offset: start + lead, length: raw.length - lead })
    }
  }
  // usuń puste linie na początku i końcu
  while (out[0]?.kind === 'blank') out.shift()
  while (out[out.length - 1]?.kind === 'blank') out.pop()
  return out
}

export function partyRows(p: Party): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
  if (p.address) rows.push({ label: p.kind === 'firma' ? 'Siedziba / adres' : 'Adres', value: p.address })
  if (p.idNumber) rows.push({ label: p.kind === 'firma' ? 'NIP / KRS' : 'PESEL', value: p.idNumber })
  if (p.kind === 'firma' && p.representative) rows.push({ label: 'Reprezentacja', value: p.representative })
  if (p.email) rows.push({ label: 'E-mail', value: p.email })
  return rows
}

/** Rodzaj dokumentu do nagłówka (np. „Umowa o dzieło”). */
export function documentKind(c: Contract): string {
  return getTemplate(c.templateId)?.name ?? c.analysis?.contractType ?? 'Umowa'
}

export function stageLabel(c: Contract): string {
  return c.stage === 'signed' ? 'Umowa podpisana' : c.stage === 'agreed' ? 'Wersja uzgodniona przez strony' : c.stage === 'shared' ? 'Projekt w negocjacjach' : 'Projekt umowy'
}

/** Czy zapis o stronach jest w pełni odwzorowany przez kolumny (projekt z kreatora). */
export function partiesClauseIsGenerated(c: Contract, clause: Clause | undefined): boolean {
  return c.source === 'template' && !!clause && clause.text.startsWith('Umowa zostaje zawarta pomiędzy')
}
