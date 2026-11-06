import type { AnalysisResult, Clause, Finding, FindingSeverity } from '../types'
import { nowIso, plural, uid, wordCount } from './utils'

/**
 * Wstępna analiza oparta na regułach (bez modelu językowego).
 * Wyszukuje typowe sformułowania i braki – nie zastępuje oceny prawnika
 * ani analizy wykonanej przez model AI z dostępem do źródeł prawa.
 */

export function parseClauses(raw: string): Clause[] {
  const text = raw.replace(/\r\n/g, '\n').replace(/ /g, ' ').trim()
  if (!text) return []
  const lines = text.split('\n')
  const isHeading = (l: string) => /^\s*(§\s*\d+|Art(ykuł|\.)\s*\d+|Rozdział\s+[IVX\d]+)/i.test(l)
  const clauses: Clause[] = []

  if (lines.filter(isHeading).length >= 2) {
    let current: { title: string; body: string[] } | null = null
    const preamble: string[] = []
    for (const line of lines) {
      if (isHeading(line)) {
        if (current) clauses.push(mk(current.title, current.body.join('\n')))
        const rest = line.replace(/^\s*(§\s*\d+|Art(ykuł|\.)\s*\d+|Rozdział\s+[IVX\d]+)\.?\s*/i, '').trim()
        current = { title: rest && rest.length < 90 ? rest : '', body: rest.length >= 90 ? [rest] : [] }
      } else if (current) {
        if (!current.title && line.trim() && line.trim().length < 70 && !/[.;:]$/.test(line.trim()) && current.body.length === 0) {
          current.title = line.trim()
        } else current.body.push(line)
      } else preamble.push(line)
    }
    if (current) clauses.push(mk(current.title, current.body.join('\n')))
    const pre = preamble.join('\n').trim()
    if (pre) clauses.unshift(mk('Wstęp i strony', pre))
  } else {
    const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
    for (const b of blocks) {
      const [first, ...rest] = b.split('\n')
      if (rest.length && first.length < 70 && !/[.;:]$/.test(first)) clauses.push(mk(first, rest.join('\n')))
      else clauses.push(mk('', b))
    }
  }
  return clauses
    .filter((c) => c.text.trim() || c.title)
    .slice(0, 80)
    .map((c, i) => ({ ...c, title: c.title || `Postanowienie ${i + 1}` }))

  function mk(title: string, body: string): Clause {
    return { id: uid('cl'), title: title.replace(/[.:]$/, ''), text: body.trim() }
  }
}

interface Rule {
  id: string
  re: RegExp
  unless?: RegExp
  severity: FindingSeverity | ((m: RegExpMatchArray, clause: string) => FindingSeverity | null)
  category: Finding['category']
  title: string
  explanation: string
  suggestion: (sentence: string, m: RegExpMatchArray) => string
}

const RULES: Rule[] = [
  {
    id: 'liability-exclusion',
    re: /(wyłącza(?:\s+się)?\s+(?:wszelką\s+)?odpowiedzialność|nie\s+ponosi\s+(?:żadnej\s+)?odpowiedzialności)/i,
    severity: 'high',
    category: 'ryzyko',
    title: 'Szerokie wyłączenie odpowiedzialności',
    explanation:
      'Zapis może sprawić, że jedna strona nie odpowiada za szkody nawet wtedy, gdy nie wykona umowy. Takie wyłączenie zwykle nie obejmuje szkód wyrządzonych umyślnie, ale brzmienie może prowadzić do sporów. Bezpieczniej jest ograniczyć odpowiedzialność kwotowo i wzajemnie.',
    suggestion: () =>
      'Odpowiedzialność każdej ze Stron z tytułu niewykonania lub nienależytego wykonania umowy jest ograniczona do wysokości wynagrodzenia należnego na podstawie umowy, z wyjątkiem szkód wyrządzonych umyślnie lub wskutek rażącego niedbalstwa.',
  },
  {
    id: 'unilateral-change',
    re: /(może\s+jednostronnie\s+(?:zmienić|zmieniać)|zastrzega\s+sobie\s+prawo\s+do\s+(?:jednostronnej\s+)?zmiany)/i,
    severity: 'high',
    category: 'ryzyko',
    title: 'Jednostronna zmiana warunków',
    explanation:
      'Jedna strona może zmieniać warunki bez zgody drugiej. To oznacza, że uzgodnione dziś zasady (np. cena lub zakres) mogą się zmienić w trakcie współpracy.',
    suggestion: () =>
      'Zmiana warunków umowy wymaga zgody obu Stron wyrażonej w formie pisemnej lub elektronicznej. Strona proponująca zmianę przedstawia ją z co najmniej 30-dniowym wyprzedzeniem.',
  },
  {
    id: 'termination-any-time',
    re: /(może\s+(?:w\s+każdym\s+czasie\s+)?wypowiedzieć[^.]{0,80}(?:w\s+każdym\s+czasie|bez\s+zachowania\s+okresu\s+wypowiedzenia|ze\s+skutkiem\s+natychmiastowym))/i,
    unless: /(każda\s+ze\s+stron|obie\s+strony)/i,
    severity: 'medium',
    category: 'ryzyko',
    title: 'Natychmiastowe wypowiedzenie tylko dla jednej strony',
    explanation:
      'Zapis pozwala jednej stronie zakończyć umowę w dowolnym momencie, bez okresu przejściowego. Druga strona może zostać bez wynagrodzenia lub bez usługi z dnia na dzień.',
    suggestion: () =>
      'Każda ze Stron może wypowiedzieć umowę z zachowaniem 1-miesięcznego okresu wypowiedzenia. Rozwiązanie umowy bez zachowania okresu wypowiedzenia jest możliwe wyłącznie w razie rażącego naruszenia umowy, którego druga Strona nie usunęła w terminie 7 dni od wezwania.',
  },
  {
    id: 'auto-renewal',
    re: /(przedłuża\s+się\s+automatycznie|ulega\s+automatycznemu\s+przedłużeniu|automatycznie\s+przedłuża)/i,
    severity: 'medium',
    category: 'termin',
    title: 'Automatyczne przedłużenie umowy',
    explanation:
      'Umowa przedłuży się sama, jeśli nie złożysz oświadczenia w odpowiednim momencie. Łatwo przeoczyć termin i zostać związanym na kolejny okres.',
    suggestion: () =>
      'Umowa może zostać przedłużona na kolejny okres na podstawie zgodnego oświadczenia Stron złożonego najpóźniej 30 dni przed upływem okresu jej obowiązywania. Usługodawca przypomni o zbliżającym się terminie co najmniej 14 dni wcześniej.',
  },
  {
    id: 'penalty-uncapped',
    re: /(kar[ęyaą]\s+umown[ąaye][^.]{0,140})/i,
    unless: /(maksymaln|łączn[aie]\s+(?:wysokość|kwota)|nie\s+więcej\s+niż|nie\s+może\s+przekroczyć|limit)/i,
    severity: (_m, clause) => {
      const pct = clause.match(/(\d+(?:[.,]\d+)?)\s*%[^.]{0,40}(za\s+każdy\s+dzień|dziennie)/i)
      if (pct && parseFloat(pct[1].replace(',', '.')) >= 0.5) return 'high'
      return 'medium'
    },
    category: 'ryzyko',
    title: 'Kara umowna bez górnego limitu',
    explanation:
      'Kara naliczana bez maksymalnej kwoty może urosnąć do wartości wyższej niż całe wynagrodzenie. Warto ustalić limit i sprawdzić, czy kary są przewidziane dla obu stron.',
    suggestion: (s) =>
      `${s.replace(/\.$/, '')}, przy czym łączna wysokość kar umownych nie może przekroczyć 10% wynagrodzenia określonego w umowie. Kary przysługują wyłącznie z tytułu okoliczności, za które zobowiązana Strona ponosi odpowiedzialność.`,
  },
  {
    id: 'payment-upfront',
    re: /((?:100\s*%|całość|całe\s+wynagrodzenie|całą\s+cenę|całej\s+kwoty)[^.]{0,80}(?:z\s+góry|przed\s+rozpoczęciem|w\s+dniu\s+podpisania))|((?:płatne|płatna|płatny)\s+z\s+góry)/i,
    severity: 'medium',
    category: 'płatność',
    title: 'Płatność z góry bez podziału na etapy',
    explanation: 'Wynagrodzenie jest płatne z góry, niezależnie od postępów prac. Jeśli coś pójdzie nie tak, odzyskanie pieniędzy może być trudne.',
    suggestion: () => 'Wynagrodzenie płatne będzie w dwóch częściach: 30% w terminie 7 dni od podpisania umowy oraz 70% w terminie 14 dni od odbioru prac potwierdzonego przez Zamawiającego.',
  },
  {
    id: 'long-payment',
    re: /w\s+terminie\s+(\d{2,3})\s+dni/i,
    severity: (m, clause) => (parseInt(m[1], 10) >= 60 && /(płatn|zapłat|faktur|wynagrodz)/i.test(clause) ? 'medium' : null),
    category: 'płatność',
    title: 'Długi termin płatności',
    explanation:
      'Termin zapłaty jest długi, co oznacza, że na pieniądze trzeba będzie czekać kilka miesięcy. W relacjach między firmami długie terminy płatności mogą podlegać ograniczeniom – warto to sprawdzić z księgowym lub prawnikiem.',
    suggestion: (s, m) => s.replace(m[0], 'w terminie 14 dni'),
  },
  {
    id: 'vague-term',
    re: /(niezwłocznie|w\s+rozsądnym\s+terminie|w\s+miarę\s+możliwości|w\s+odpowiednim\s+czasie|według\s+uznania)/i,
    severity: 'low',
    category: 'niejasność',
    title: 'Niedookreślony termin lub kryterium',
    explanation:
      'Sformułowanie jest nieprecyzyjne – strony mogą rozumieć je inaczej. Konkretna liczba dni lub mierzalne kryterium ułatwia ocenę, czy obowiązek został wykonany.',
    suggestion: (s, m) => s.replace(m[0], 'w terminie 7 dni roboczych'),
  },
  {
    id: 'ip-all-fields',
    re: /(wszelkie\s+(?:autorskie\s+)?prawa|na\s+wszystkich\s+(?:znanych\s+)?polach\s+eksploatacji)/i,
    severity: 'medium',
    category: 'niejasność',
    title: 'Ogólne przeniesienie praw autorskich',
    explanation:
      'Przeniesienie praw „na wszystkich polach eksploatacji” bez ich wymienienia może okazać się nieskuteczne lub sporne. Pola eksploatacji (np. publikacja w internecie, druk, modyfikacja) warto wymienić konkretnie.',
    suggestion: () =>
      'Z chwilą zapłaty wynagrodzenia autorskie prawa majątkowe do utworu przechodzą na Zamawiającego na następujących polach eksploatacji: utrwalanie i zwielokrotnianie dowolną techniką, wprowadzanie do pamięci komputera, publikacja w internecie, wykorzystanie w materiałach reklamowych oraz modyfikowanie utworu.',
  },
  {
    id: 'non-compete',
    re: /(zakaz\s+konkurencji|działalności\s+konkurencyjnej)/i,
    unless: /(odszkodowan|rekompensat|wynagrodzeni[ea]\s+za\s+powstrzymanie)/i,
    severity: 'medium',
    category: 'ryzyko',
    title: 'Zakaz konkurencji bez rekompensaty',
    explanation:
      'Zakaz konkurencji ogranicza możliwość zarabiania po zakończeniu współpracy. Zwykle powinien być ograniczony w czasie i zakresie, a często przewiduje się za niego wynagrodzenie.',
    suggestion: () =>
      'Przez 6 miesięcy po zakończeniu umowy Wykonawca nie będzie świadczył usług na rzecz bezpośrednich konkurentów Zamawiającego wskazanych w załączniku. Z tego tytułu Zamawiający wypłaci Wykonawcy miesięczne wynagrodzenie w wysokości 25% średniego miesięcznego wynagrodzenia z ostatnich 6 miesięcy.',
  },
  {
    id: 'assignment',
    re: /(może\s+przenieść[^.]{0,80}bez\s+(?:zgody|zgodę))/i,
    severity: 'medium',
    category: 'ryzyko',
    title: 'Przeniesienie praw z umowy bez zgody',
    explanation: 'Jedna strona może przekazać umowę lub należności komuś innemu bez Twojej zgody. Możesz nagle mieć do czynienia z innym kontrahentem.',
    suggestion: () => 'Przeniesienie praw lub obowiązków wynikających z umowy na osobę trzecią wymaga uprzedniej zgody drugiej Strony wyrażonej w formie pisemnej lub elektronicznej.',
  },
  {
    id: 'court',
    re: /(sąd\s+właściwy\s+(?:miejscowo\s+)?dla\s+siedziby\s+[A-ZŁŚŻŹĆa-ząęółśżźćń]+)/i,
    severity: 'low',
    category: 'niejasność',
    title: 'Sąd właściwy dla jednej strony',
    explanation: 'Ewentualny spór będzie rozpatrywany w mieście wygodnym dla jednej strony. Dla drugiej może to oznaczać koszty dojazdu. Warto rozważyć zapis neutralny.',
    suggestion: () => 'Spory wynikające z umowy Strony będą starały się rozwiązać polubownie, a w razie braku porozumienia rozstrzygnie je sąd właściwy według przepisów ogólnych.',
  },
  {
    id: 'deposit',
    re: /(zadat(?:ek|ku)|zaliczk[aęi])/i,
    severity: 'low',
    category: 'płatność',
    title: 'Zadatek czy zaliczka – sprawdź skutki',
    explanation: 'Zadatek i zaliczka mają różne skutki, gdy umowa nie zostanie wykonana. Upewnij się, że użyte słowo odpowiada temu, co strony faktycznie chcą osiągnąć, i opisz, co dzieje się z kwotą w razie rezygnacji.',
    suggestion: (s) => `${s.replace(/\.$/, '')}. W razie niewykonania umowy przez którąkolwiek ze Stron kwota ta zostanie rozliczona w sposób opisany w niniejszym paragrafie.`,
  },
]

const MISSING: { id: string; present: RegExp; title: string; explanation: string; clauseTitle: string; text: string; severity: FindingSeverity }[] = [
  {
    id: 'missing-termination',
    present: /(wypowie|rozwiąz|odstąp)/i,
    title: 'Brak zasad zakończenia umowy',
    explanation: 'Umowa nie mówi, jak i kiedy można ją zakończyć. W razie problemów żadna ze stron nie będzie wiedziała, jak się wycofać.',
    clauseTitle: 'Wypowiedzenie umowy',
    text: 'Każda ze Stron może wypowiedzieć umowę z zachowaniem 1-miesięcznego okresu wypowiedzenia, ze skutkiem na koniec miesiąca kalendarzowego. Wypowiedzenie wymaga formy pisemnej lub elektronicznej.',
    severity: 'medium',
  },
  {
    id: 'missing-liability',
    present: /odpowiedzialn/i,
    title: 'Brak zapisu o odpowiedzialności',
    explanation: 'Umowa nie określa, kto i do jakiej kwoty odpowiada za szkody. Wtedy obowiązują zasady ogólne, co może być niekorzystne dla jednej ze stron.',
    clauseTitle: 'Odpowiedzialność',
    text: 'Odpowiedzialność każdej ze Stron z tytułu niewykonania lub nienależytego wykonania umowy jest ograniczona do wysokości wynagrodzenia należnego na jej podstawie, z wyjątkiem szkód wyrządzonych umyślnie.',
    severity: 'medium',
  },
  {
    id: 'missing-confidentiality',
    present: /poufn/i,
    title: 'Brak zapisu o poufności',
    explanation: 'Jeśli w trakcie współpracy strony wymieniają informacje biznesowe lub dane osobowe, warto zdecydować, co wolno z nimi zrobić.',
    clauseTitle: 'Poufność',
    text: 'Strony zachowają w poufności informacje uzyskane w związku z umową przez czas jej trwania oraz 2 lata po jej zakończeniu, z wyjątkiem informacji publicznie dostępnych lub takich, których ujawnienia wymagają przepisy prawa.',
    severity: 'low',
  },
  {
    id: 'missing-payment-term',
    present: /(w\s+terminie\s+\d+\s+dni|do\s+dnia|\d+\.\s*dnia\s+każdego|płatn[ey]\s+(?:z\s+góry|do))/i,
    title: 'Brak jasnego terminu płatności',
    explanation: 'Nie znaleziono konkretnego terminu zapłaty. Bez niego trudniej ustalić, od kiedy płatność jest opóźniona.',
    clauseTitle: 'Termin płatności',
    text: 'Płatność nastąpi przelewem w terminie 14 dni od dnia doręczenia prawidłowo wystawionej faktury lub rachunku.',
    severity: 'medium',
  },
  {
    id: 'missing-changes',
    present: /(zmian[ay]\s+umowy|zmiana\s+niniejszej|aneks)/i,
    title: 'Brak zasad wprowadzania zmian',
    explanation: 'Umowa nie mówi, jak ją zmieniać. Ustalenia „na telefon” mogą później budzić wątpliwości.',
    clauseTitle: 'Zmiany umowy',
    text: 'Zmiany umowy wymagają zgody obu Stron wyrażonej w formie pisemnej lub elektronicznej pod rygorem nieważności.',
    severity: 'low',
  },
]

const TYPES: [RegExp, string][] = [
  [/zachowani\w*\s+poufności|\bNDA\b/i, 'Umowa o zachowaniu poufności'],
  [/najm|najemc|wynajmując/i, 'Umowa najmu'],
  [/o\s+dzieło/i, 'Umowa o dzieło'],
  [/zleceni/i, 'Umowa zlecenia'],
  [/pożyczk/i, 'Umowa pożyczki'],
  [/licencj/i, 'Umowa licencyjna'],
  [/sprzeda|kupując/i, 'Umowa sprzedaży'],
  [/ugod/i, 'Ugoda'],
  [/świadczeni\w*\s+usług|usługodawc|usługobiorc/i, 'Umowa o świadczenie usług'],
  [/współprac/i, 'Umowa o współpracy'],
]

/** Waga uwagi w analizie podstawowej (bez modelu AI). */
function weight(sev: FindingSeverity, category: Finding['category']): Pick<Finding, 'priority' | 'importance' | 'aspect'> {
  return {
    priority: sev === 'low' ? 'kosmetyka' : 'najważniejsze',
    importance: sev === 'high' ? 5 : sev === 'medium' ? 3 : 2,
    aspect: category === 'płatność' ? 'finansowe' : category === 'termin' ? 'operacyjne' : category === 'brak' ? 'biznesowe' : 'prawne',
  }
}

function sentenceAround(text: string, index: number): string {
  const before = text.slice(0, index)
  const startCandidates = [before.lastIndexOf('. '), before.lastIndexOf('\n'), before.lastIndexOf('; ')]
  const start = Math.max(...startCandidates) + 1
  const after = text.slice(index)
  const endRel = after.search(/(\.\s|\.$|\n|;\s)/)
  const end = endRel === -1 ? text.length : index + endRel + 1
  return text.slice(start, end).trim()
}

/** Zamienia formę „zwanym dalej Klientem / Agencją” na mianownik (heurystyka). */
function toNominative(role: string): string {
  return role
    .split(' ')
    .map((w) => {
      if (/ą$/.test(w)) return w.replace(/ą$/, 'a')
      if (/(ym|im)$/.test(w) && w.length > 5) return w.replace(/m$/, '')
      if (/iem$/.test(w)) return w.replace(/iem$/, '')
      if (/em$/.test(w) && w.length > 4) return w.replace(/em$/, '')
      return w
    })
    .join(' ')
}

function detectParties(text: string): { name: string; role: string; details?: string }[] {
  const head = text.slice(0, 2500)
  const re = /zwan[a-ząęółśżźćń]*\s+(?:dalej\s+|w\s+dalszej\s+części\s+umowy\s+)?[„"«]?([A-ZŁŚŻŹĆ][\wąęółśżźćńĄĘÓŁŚŻŹĆŃ]+(?:\s[A-ZŁŚŻŹĆ][\wąęółśżźćń]+)?)[”"»]?/g
  const out: { name: string; role: string; details?: string }[] = []
  let prevEnd = Math.max(0, head.search(/pomiędzy|między/i))
  for (const m of head.matchAll(re)) {
    const role = toNominative(m[1].trim())
    if (/^Stron/i.test(role) || out.some((o) => o.role === role)) continue
    const idx = m.index ?? 0
    const lineStart = head.lastIndexOf('\n', idx) + 1
    let seg = head.slice(Math.max(prevEnd, lineStart), idx)
    seg = seg
      .replace(/^[\s,:;]*(?:pomiędzy|między)?[\s:]*/i, '')
      .replace(/^(?:a|oraz)\s+/i, '')
      .replace(/^\d+[.)]\s*/, '')
    const name = seg
      .split(/,|\s+z\s+siedzibą|\s+zamieszkał|\s+NIP|\s+PESEL|\s+KRS|\s+reprezentowan/i)[0]
      .trim()
    const details = seg
      .slice(name.length)
      .replace(/^[\s,]+|[\s,]+$/g, '')
      .slice(0, 160)
    out.push({ name: name.length >= 3 ? name.slice(0, 90) : 'Nie wskazano nazwy', role, details: details || undefined })
    prevEnd = idx + m[0].length
    if (out.length === 2) break
  }
  return out
}

function extractObligations(text: string, parties: { role: string }[]): { party: string; items: string[] }[] {
  const sentences = text.split(/(?<=[.;])\s+|\n/)
  return parties.map((p) => {
    const root = p.role.split(' ')[0].slice(0, Math.max(5, p.role.length - 2))
    const items = sentences
      .filter((s) => new RegExp(`${root}\\w*\\s+(?:zobowiązuje|jest\\s+zobowiązan|zapłaci|wykona|dostarczy|przekaże|zapewni)`, 'i').test(s))
      .map((s) => s.replace(/^\s*\d+[.)]\s*/, '').trim())
      .filter((s) => s.length > 10)
      .slice(0, 4)
    return { party: p.role, items }
  })
}

function extractDates(text: string): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = []
  const seen = new Set<string>()
  const push = (label: string, value: string) => {
    const key = value.toLowerCase()
    if (seen.has(key) || out.length >= 6) return
    seen.add(key)
    out.push({ label, value })
  }
  for (const m of text.matchAll(/(\d{1,2}[./-]\d{1,2}[./-]\d{4}|\d{1,2}\s+(?:stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|października|listopada|grudnia)\s+\d{4})/gi)) {
    const ctx = sentenceAround(text, m.index ?? 0)
    push(/obowiązuje|zawart|od\s+dnia/i.test(ctx) ? 'Data w umowie' : 'Termin', m[1])
  }
  for (const m of text.matchAll(/(w\s+terminie\s+\d+\s+(?:dni|miesięcy|tygodni)(?:\s+roboczych)?[^.;\n]{0,60})/gi)) push('Termin', m[1].trim())
  for (const m of text.matchAll(/(okres(?:em)?\s+wypowiedzenia[^.;\n]{0,50})/gi)) push('Wypowiedzenie', m[1].trim())
  for (const m of text.matchAll(/(na\s+czas\s+(?:nie)?określony[^.;\n]{0,40})/gi)) push('Czas trwania', m[1].trim())
  return out
}

function extractPayments(text: string): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = []
  for (const m of text.matchAll(/((?:\d{1,3}(?:[ .]\d{3})+|\d+)(?:,\d{2})?\s*(?:zł|PLN|złotych)(?:\s+(?:netto|brutto))?)/gi)) {
    const ctx = sentenceAround(text, m.index ?? 0)
    const label = /kar/i.test(ctx) ? 'Kara umowna' : /kaucj/i.test(ctx) ? 'Kaucja' : /czynsz/i.test(ctx) ? 'Czynsz' : /zadat|zaliczk/i.test(ctx) ? 'Zadatek / zaliczka' : 'Kwota'
    if (!out.some((o) => o.value === m[1])) out.push({ label, value: m[1] })
    if (out.length >= 6) break
  }
  for (const m of text.matchAll(/(\d+(?:[.,]\d+)?\s*%[^.;\n]{0,60})/g)) {
    if (out.length >= 8) break
    out.push({ label: 'Wartość procentowa', value: m[1].trim() })
  }
  return out
}

export function analyzeContract(text: string, clauses: Clause[], sourceName: string): AnalysisResult {
  const findings: Finding[] = []
  for (const clause of clauses) {
    const body = `${clause.title}\n${clause.text}`
    for (const rule of RULES) {
      const m = clause.text.match(rule.re)
      if (!m) continue
      const sentence = sentenceAround(clause.text, m.index ?? 0)
      if (rule.unless && rule.unless.test(sentence)) continue
      const severity = typeof rule.severity === 'function' ? rule.severity(m, body) : rule.severity
      if (!severity) continue
      if (findings.some((f) => f.clauseId === clause.id && f.title === rule.title)) continue
      findings.push({
        id: uid('f'),
        clauseId: clause.id,
        severity,
        category: rule.category,
        title: rule.title,
        explanation: rule.explanation,
        suggestion: rule.suggestion(sentence, m),
        excerpt: sentence,
        status: 'pending',
        ...weight(severity, rule.category),
      })
    }
  }
  for (const miss of MISSING) {
    if (!miss.present.test(text)) {
      findings.push({
        id: uid('f'),
        clauseId: null,
        severity: miss.severity,
        category: 'brak',
        title: miss.title,
        explanation: miss.explanation,
        suggestion: miss.text,
        excerpt: miss.clauseTitle,
        status: 'pending',
        ...weight(miss.severity, 'brak'),
      })
    }
  }

  const contractType = TYPES.find(([re]) => re.test(text.slice(0, 1500)))?.[1] ?? TYPES.find(([re]) => re.test(text))?.[1] ?? 'Umowa dwustronna'
  const parties = detectParties(text)
  const obligations = extractObligations(text, parties)
  const high = findings.filter((f) => f.severity === 'high').length
  const medium = findings.filter((f) => f.severity === 'medium').length
  const missing = findings.filter((f) => f.category === 'brak').length
  const words = wordCount(text)

  const partyText = parties.length >= 2 ? ` między stronami: ${parties[0].role} (${parties[0].name}) i ${parties[1].role} (${parties[1].name})` : ''
  const flagged = high + medium
  const summary =
    `${contractType}${partyText}. Dokument ma ${clauses.length} ${plural(clauses.length, 'postanowienie', 'postanowienia', 'postanowień')} i ok. ${words} słów. ` +
    (flagged > 0
      ? `Zapisy wymagające uwagi: ${flagged}${high ? `, w tym ${high} o podwyższonym ryzyku` : ''}. `
      : 'Nie znaleziono zapisów o podwyższonym ryzyku według sprawdzanych kryteriów. ') +
    (missing ? `Brakujące typowe postanowienia: ${missing}.` : 'Umowa zawiera typowe postanowienia, które sprawdzamy.')

  return {
    createdAt: nowIso(),
    summary,
    contractType,
    parties,
    obligations,
    dates: extractDates(text),
    payments: extractPayments(text),
    findings: findings.sort((a, b) => sevRank(a.severity) - sevRank(b.severity)),
    sourceName,
    wordCount: words,
    engine: 'rules',
  }
}

function sevRank(s: FindingSeverity) {
  return s === 'high' ? 0 : s === 'medium' ? 1 : 2
}

/** Krótkie wyjaśnienie zapisu prostym językiem – używane przez prywatnego asystenta. */
export function explainClause(clause: Clause, findings: Finding[]): string {
  const related = findings.filter((f) => f.clauseId === clause.id)
  const base = clause.explanation ?? genericExplanation(clause)
  if (!related.length) return `${base}\n\nNie widzę w tym zapisie typowych sygnałów ryzyka, ale warto sprawdzić, czy opisuje on Waszą sytuację dokładnie tak, jak się umówiliście.`
  return `${base}\n\nNa co zwrócić uwagę:\n${related.map((f) => `• ${f.title} – ${f.explanation}`).join('\n')}`
}

function genericExplanation(c: Clause): string {
  const t = `${c.title} ${c.text}`.toLowerCase()
  if (/wynagrodz|płatn|cen[aęy]|czynsz/.test(t)) return 'Ten zapis określa, ile, kiedy i w jaki sposób trzeba zapłacić. Sprawdź kwotę (netto czy brutto), termin oraz to, od jakiego zdarzenia liczy się termin zapłaty.'
  if (/wypowied|rozwiąz/.test(t)) return 'Ten zapis mówi, jak można zakończyć umowę. Sprawdź okres wypowiedzenia, formę oświadczenia i czy obie strony mają podobne uprawnienia.'
  if (/odpowiedzialn/.test(t)) return 'Ten zapis określa, kto odpowiada za szkody i do jakiej kwoty. Zwróć uwagę, czy ograniczenia działają w obie strony.'
  if (/poufn/.test(t)) return 'Ten zapis chroni informacje przekazywane między stronami. Sprawdź, jak długo obowiązuje i jakie są wyjątki.'
  if (/kar/.test(t)) return 'Ten zapis przewiduje kary umowne. Sprawdź, za co dokładnie są naliczane, czy mają limit i czy dotyczą obu stron.'
  if (/autorsk|licencj|eksploatac/.test(t)) return 'Ten zapis określa, kto może korzystać z rezultatów pracy i w jakim zakresie. Pola eksploatacji powinny być wymienione konkretnie.'
  if (/termin|czas/.test(t)) return 'Ten zapis określa terminy. Sprawdź, czy są konkretne i realne do dotrzymania oraz co się stanie w razie opóźnienia.'
  return 'Ten zapis porządkuje wzajemne prawa i obowiązki stron. Przeczytaj go pod kątem tego, czy jasno wynika, kto, co i do kiedy ma zrobić.'
}
