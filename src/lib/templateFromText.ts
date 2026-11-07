import type { MyTemplate, Party, PartyId, SavedParty } from '../types'
import { analyzeContract, normalizeContractText, parseClauses } from './analyzer'
import { nowIso, uid } from './utils'

/**
 * Wzór z tekstu umowy (wgrany plik): zapisy + strony. Twoja strona – ta, która pasuje
 * do zapisanych danych (albo wskazana), druga zostanie podmieniona przy tworzeniu umowy.
 */
export function templateFromText(text: string, name: string, own?: SavedParty, side?: PartyId): MyTemplate | null {
  const clean = normalizeContractText(text)
  const clauses = parseClauses(clean)
  if (!clauses.length) return null
  const a = analyzeContract(clean, clauses, name)
  const toParty = (i: 0 | 1): Party => {
    const p = a.parties[i]
    return { id: i === 0 ? 'A' : 'B', role: p?.role || (i === 0 ? 'Strona 1' : 'Strona 2'), kind: p?.kind ?? 'osoba', name: p && !/nie wskazano/i.test(p.name) ? p.name : '', idNumber: p?.idNumber ?? '', address: p?.address ?? '', email: '', representative: p?.representative ?? '' }
  }
  const parties: [Party, Party] = [toParty(0), toParty(1)]
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\d]+/gu, ' ').trim()
  const ownName = own?.name ? norm(own.name) : ''
  const matches = (p: Party) => !!ownName && !!p.name && (norm(p.name).includes(ownName) || ownName.includes(norm(p.name)))
  const ownerPartyId: PartyId = side ?? (matches(parties[1]) && !matches(parties[0]) ? 'B' : 'A')
  return { id: uid('mt'), name: a.contractType && a.contractType !== 'Umowa' ? a.contractType : name, createdAt: nowIso(), ownerPartyId, parties, clauses }
}
