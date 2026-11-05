import type { ChatMessage, Clause, Contract, Finding, PartyId } from '../types'
import { analyzeContract, explainClause } from './analyzer'
import { diffWords, nowIso, otherParty, uid } from './utils'

/**
 * Prywatny asystent w widoku umowy (odpowiedzi widoczne tylko dla pytającej strony).
 * Odpowiedzi są budowane z analizy regułowej i treści umowy – asystent nie zmienia
 * dokumentu i nie składa propozycji w imieniu użytkownika. Prezentuje argumenty obu stron.
 */

export const PRIVATE_PROMPTS = ['Wyjaśnij wybrany zapis', 'Na co zwrócić uwagę w tej umowie?', 'Jak odpowiedzieć na propozycje drugiej strony?', 'Zaproponuj wyważone brzmienie wybranego zapisu']

function findingsFor(c: Contract): Finding[] {
  if (c.analysis) return c.analysis.findings
  const text = c.clauses.map((x) => `${x.title}\n${x.text}`).join('\n\n')
  return analyzeContract(text, c.clauses, c.title).findings
}

export function privateAnswer(question: string, c: Contract, viewer: PartyId, selected: Clause | null): ChatMessage {
  const q = question.toLowerCase()
  const findings = findingsFor(c)
  const msg = (text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({ id: uid('m'), role: 'assistant', text, createdAt: nowIso(), ...extra })
  const me = c.parties.find((p) => p.id === viewer)!
  const other = c.parties.find((p) => p.id === otherParty(viewer))!

  if (/wyjaśnij|co\s+oznacza|co\s+znaczy|nie\s+rozumiem/.test(q)) {
    if (!selected) return msg('Wybierz zapis w dokumencie (kliknij jego tytuł), a wyjaśnię go prostym językiem.')
    return msg(`„${selected.title}” – w skrócie:\n\n${explainClause(selected, findings)}`)
  }

  if (/brzmieni|przeredaguj|sformułuj|popraw/.test(q)) {
    if (!selected) return msg('Wybierz zapis w dokumencie, a zaproponuję wyważone brzmienie.')
    const f = findings.find((x) => x.clauseId === selected.id && x.category !== 'brak')
    if (!f) {
      return msg(
        `Nie widzę w zapisie „${selected.title}” typowych sygnałów ryzyka, więc nie proponuję zmian na siłę. Jeśli coś Ci w nim nie odpowiada, opisz, co chcesz osiągnąć – pomogę to ująć tak, by było zrozumiałe dla obu stron.`,
      )
    }
    const newText = f.excerpt && selected.text.includes(f.excerpt) ? selected.text.replace(f.excerpt, f.suggestion) : `${selected.text}\n${f.suggestion}`
    return msg(
      `Propozycja dotyczy problemu: ${f.title.toLowerCase()}.\n\n${f.explanation}\n\nPoniższe brzmienie stara się chronić interesy obu stron – ${me.role} i ${other.role}. Nic nie zmieni się w dokumencie, dopóki sam(a) nie wyślesz propozycji, a druga strona jej nie zaakceptuje.`,
      { suggestion: { clauseId: selected.id, text: newText } },
    )
  }

  if (/propozycj|odpowied|zaakceptow|odrzuc/.test(q)) {
    const open = c.proposals.filter((p) => p.status === 'open' && p.authorPartyId !== viewer)
    if (!open.length) return msg('Druga strona nie ma obecnie otwartych propozycji, na które trzeba odpowiedzieć.')
    const parts = open.map((p) => {
      const clause = c.clauses.find((x) => x.id === p.clauseId)
      const d = diffWords(p.originalText, p.newText)
      const added = d.filter((x) => x.type === 'add').map((x) => x.text.trim()).filter(Boolean).join(' ')
      const removed = d.filter((x) => x.type === 'del').map((x) => x.text.trim()).filter(Boolean).join(' ')
      return `• „${clause?.title ?? 'Zapis'}” (${p.authorName})\n  ${removed ? `Usuwa: „${removed.slice(0, 140)}”. ` : ''}${added ? `Dodaje: „${added.slice(0, 160)}”.` : ''}\n  Uzasadnienie drugiej strony: ${p.comment || 'brak'}`
    })
    return msg(
      `Otwarte propozycje drugiej strony:\n\n${parts.join('\n\n')}\n\nJak podejść do odpowiedzi:\n• Zastanów się, jaki problem druga strona chce rozwiązać – często da się go rozwiązać inaczej.\n• Jeśli zmiana jest akceptowalna – zaakceptuj ją. Jeśli częściowo – odrzuć i zaproponuj własne brzmienie z krótkim uzasadnieniem.\n• Rzeczowy komentarz zwykle przyspiesza uzgodnienie bardziej niż samo odrzucenie.\n\nDecyzja należy do Ciebie – nie akceptuję ani nie odrzucam niczego w Twoim imieniu.`,
    )
  }

  if (/uwag|ryzyk|zwrócić|sprawdzi|bezpieczn|problem/.test(q)) {
    const relevant = findings.filter((f) => f.status !== 'rejected').slice(0, 5)
    if (!relevant.length) return msg('Według sprawdzanych kryteriów nie widzę zapisów o podwyższonym ryzyku. Warto jednak upewnić się, że przedmiot umowy, kwoty i terminy dokładnie odpowiadają temu, co ustaliliście.')
    return msg(
      `Najważniejsze punkty do przemyślenia:\n\n${relevant
        .map((f) => {
          const cl = c.clauses.find((x) => x.id === f.clauseId)
          return `• ${f.title}${cl ? ` (${cl.title})` : ' (brakujący zapis)'} – ${f.explanation}`
        })
        .join('\n\n')}\n\nTo wstępna ocena oparta na treści dokumentu. Przy dużych kwotach lub nietypowych warunkach warto skonsultować umowę z prawnikiem.`,
    )
  }

  return msg(
    `Mogę pomóc w kilku sprawach dotyczących umowy „${c.title}”:\n• wyjaśnić wybrany zapis prostym językiem,\n• wskazać, na co zwrócić uwagę,\n• omówić propozycje drugiej strony,\n• zaproponować wyważone brzmienie zapisu.\n\nNapisz, czego potrzebujesz, albo wybierz jedną z podpowiedzi. Moje odpowiedzi widzisz tylko Ty.`,
  )
}
