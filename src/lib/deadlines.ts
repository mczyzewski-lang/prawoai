import type { Contract, Deadline, DeadlineKind } from '../types'
import { uid } from './utils'

export const DEFAULT_REMIND = [7, 1]

export const KIND_LABEL: Record<DeadlineKind, string> = {
  płatność: 'Płatność',
  wypowiedzenie: 'Wypowiedzenie',
  przedłużenie: 'Przedłużenie / odnowienie',
  realizacja: 'Realizacja',
  odbiór: 'Odbiór',
  gwarancja: 'Gwarancja',
  inne: 'Inne',
}

/** Domyślne przypomnienia zależnie od rodzaju (wypowiedzenie – z dużym wyprzedzeniem). */
export function remindFor(kind: DeadlineKind): number[] {
  if (kind === 'wypowiedzenie' || kind === 'przedłużenie') return [30, 7, 1]
  if (kind === 'gwarancja') return [30, 7]
  return DEFAULT_REMIND
}

export function guessKind(text: string): DeadlineKind {
  const t = text.toLowerCase()
  if (/wypowiedz/.test(t)) return 'wypowiedzenie'
  if (/przedłuż|odnow|automatycznie/.test(t)) return 'przedłużenie'
  if (/gwaranc|rękojm/.test(t)) return 'gwarancja'
  if (/odbi[oó]r|protok/.test(t)) return 'odbiór'
  if (/płat|zapłat|faktur|wynagrodz|czynsz|rat[aęy]|zaliczk|przedpłat/.test(t)) return 'płatność'
  if (/wykona|realiz|montaż|dostaw|zakończ|przekaz/.test(t)) return 'realizacja'
  return 'inne'
}

export const toYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const fromYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}
export const todayYmd = () => toYmd(new Date())

/** Data odniesienia dla terminów względnych: podpis, a gdy go brak – utworzenie umowy. */
export function referenceDate(c: Contract): { date: string; label: string } {
  const sig = [...c.signatures].sort((a, b) => a.signedAt.localeCompare(b.signedAt))[0]
  if (sig) return { date: toYmd(new Date(sig.signedAt)), label: 'data podpisania' }
  return { date: toYmd(new Date(c.createdAt)), label: 'data utworzenia umowy (przyjęta jako data podpisania)' }
}

/** Liczba dni do terminu (ujemna = po terminie). */
export function daysUntil(date: string, today = todayYmd()): number {
  return Math.round((fromYmd(date).getTime() - fromYmd(today).getTime()) / 86_400_000)
}

export function relativeLabel(date: string): string {
  const d = daysUntil(date)
  if (d === 0) return 'dziś'
  if (d === 1) return 'jutro'
  if (d === -1) return 'wczoraj'
  if (d < 0) return `${-d} dni po terminie`
  if (d < 7) return `za ${d} dni`
  if (d < 60) return `za ${Math.round(d / 7)} tyg.`
  return `za ${Math.round(d / 30)} mies.`
}

const MONTHS = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia']

function addPeriod(base: Date, n: number, unit: string): Date {
  const d = new Date(base)
  if (/^dni|^dzie/.test(unit)) d.setDate(d.getDate() + n)
  else if (/^tydz|^tygod/.test(unit)) d.setDate(d.getDate() + 7 * n)
  else if (/^mies/.test(unit)) d.setMonth(d.getMonth() + n)
  else if (/^lat|^rok/.test(unit)) d.setFullYear(d.getFullYear() + n)
  return d
}

/**
 * Terminy odczytane regułami (bez AI): konkretne daty oraz okresy liczone od podpisania/zawarcia umowy.
 * Terminy zależne od innych zdarzeń (np. „od odbioru”) zostawia dla AI albo ręcznego uzupełnienia.
 */
export function extractDeadlinesRules(c: Contract): Deadline[] {
  const ref = fromYmd(referenceDate(c).date)
  const out: Deadline[] = []
  const seen = new Set<string>()
  const push = (d: Omit<Deadline, 'id' | 'remind' | 'source'>) => {
    const key = `${d.date}|${d.kind}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ ...d, id: uid('dl'), source: 'tekst', remind: remindFor(d.kind) })
  }
  for (const cl of c.clauses) {
    const sentences = cl.text.split(/(?<=[.;])\s+|\n+/)
    for (const s of sentences) {
      const kind = guessKind(`${cl.title} ${s}`)
      const title = `${cl.title}: ${s.trim().replace(/^\d+[.)]\s*/, '').slice(0, 90)}${s.length > 90 ? '…' : ''}`
      // 12.03.2027 / 12-03-2027
      for (const m of s.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/g)) {
        const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
        if (!Number.isNaN(d.getTime())) push({ title, date: toYmd(d), kind, basis: s.trim(), clauseId: cl.id })
      }
      // 12 grudnia 2026
      for (const m of s.matchAll(new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS.join('|')})\\s+(\\d{4})`, 'gi'))) {
        const d = new Date(Number(m[3]), MONTHS.indexOf(m[2].toLowerCase()), Number(m[1]))
        push({ title, date: toYmd(d), kind, basis: s.trim(), clauseId: cl.id })
      }
      // „w terminie 14 dni od dnia podpisania / zawarcia umowy”
      const rel = s.match(/(\d{1,3})\s*(dni|dnia|tygodni|tygodnie|miesięcy|miesiące|miesiąca|lat|lata|rok)\s*(?:roboczych\s*)?od\s*(?:dnia\s*)?(?:podpisania|zawarcia)/i)
      if (rel) push({ title, date: toYmd(addPeriod(ref, Number(rel[1]), rel[2].toLowerCase())), kind, approximate: true, basis: s.trim(), clauseId: cl.id })
      // „na okres 12 miesięcy” – koniec umowy i okno wypowiedzenia
      const term = s.match(/na\s+(?:czas\s+)?(?:okres|czas)\s+(\d{1,3})\s*(miesięcy|miesiące|lat|lata|rok|roku)/i)
      if (term) {
        const end = addPeriod(ref, Number(term[1]), term[2].toLowerCase())
        push({ title: `Koniec umowy (${cl.title})`, date: toYmd(end), kind: 'przedłużenie', approximate: true, basis: s.trim(), clauseId: cl.id })
        const notice = c.clauses.map((x) => x.text).join(' ').match(/(\d{1,2})[-\s]*(dniow|miesięczn|tygodniow)\w*\s+(?:okres\w*\s+)?wypowiedzeni/i)
        if (notice) {
          const n = Number(notice[1])
          const unit = /dni/.test(notice[2]) ? 'dni' : /tyg/.test(notice[2]) ? 'tygodni' : 'miesięcy'
          const last = addPeriod(end, -n, unit)
          push({ title: `Ostatni dzień na wypowiedzenie (${n} ${unit})`, date: toYmd(last), kind: 'wypowiedzenie', approximate: true, basis: notice[0], clauseId: cl.id })
        }
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** Odczyt terminów przez AI (serwer); rzuca błąd, gdy AI niedostępne. */
export async function extractDeadlinesAi(c: Contract): Promise<Deadline[]> {
  const ref = referenceDate(c)
  const r = await fetch('/api/deadlines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ today: todayYmd(), referenceDate: ref.date, referenceLabel: ref.label, title: c.title, clauses: c.clauses.map((x) => ({ title: x.title, text: x.text })) }),
  })
  const data = await r.json().catch(() => null)
  if (!r.ok || !data?.result) throw new Error(data?.error ?? 'Nie udało się odczytać terminów.')
  return (data.result.deadlines as { title: string; kind: DeadlineKind; date: string; approximate: boolean; basis: string; clauseIndex: number }[]).map((d) => ({
    id: uid('dl'),
    title: d.title,
    kind: d.kind,
    date: /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : '',
    approximate: d.approximate,
    basis: d.basis,
    clauseId: c.clauses[d.clauseIndex]?.id,
    source: 'ai' as const,
    remind: remindFor(d.kind),
  }))
}

/** Łączy nowo odczytane terminy z istniejącymi: ręczne i oznaczone jako wykonane zostają. */
export function mergeDeadlines(old: Deadline[] = [], fresh: Deadline[]): Deadline[] {
  const keep = old.filter((d) => d.source === 'ręcznie' || d.done)
  const keys = new Set(keep.map((d) => `${d.date}|${d.kind}`))
  return [...keep, ...fresh.filter((d) => !keys.has(`${d.date}|${d.kind}`))]
}

export interface DeadlineRef {
  d: Deadline
  c: Contract
}

/** Wszystkie terminy z umów właściciela. */
export function allDeadlines(contracts: Contract[]): DeadlineRef[] {
  return contracts.flatMap((c) => (c.deadlines ?? []).map((d) => ({ d, c })))
}

/** Przypomnienia, które powinny się już pojawić (i nie były pokazane). */
export function dueReminders(items: DeadlineRef[], shown: Set<string>, today = todayYmd()): { key: string; ref: DeadlineRef; days: number }[] {
  const out: { key: string; ref: DeadlineRef; days: number }[] = []
  for (const ref of items) {
    const { d } = ref
    if (d.done || !d.date) continue
    const left = daysUntil(d.date, today)
    if (left < -3) continue
    // najbliższy próg przypomnienia, który już minął
    const hit = [...d.remind, 0].sort((a, b) => a - b).find((n) => left <= n)
    if (hit === undefined) continue
    const key = `${d.id}:${hit}`
    if (!shown.has(key)) out.push({ key, ref, days: left })
  }
  return out
}

const icsEsc = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, '\\n')

/** Plik .ics (Google, Apple, Outlook) – wydarzenia całodniowe z alarmami. */
export function buildIcs(items: DeadlineRef[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Prawo.ai//Terminy//PL', 'CALSCALE:GREGORIAN']
  for (const { d, c } of items) {
    if (!d.date || d.done) continue
    const start = d.date.replace(/-/g, '')
    const endDate = fromYmd(d.date)
    endDate.setDate(endDate.getDate() + 1)
    lines.push('BEGIN:VEVENT', `UID:${d.id}@prawo.ai`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${toYmd(endDate).replace(/-/g, '')}`, `SUMMARY:${icsEsc(`${KIND_LABEL[d.kind]}: ${d.title}`)}`, `DESCRIPTION:${icsEsc(`Umowa: ${c.title}${d.basis ? `\n${d.basis}` : ''}`)}`)
    for (const n of d.remind) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(d.title)}`, `TRIGGER:-P${n}D`, 'END:VALARM')
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadIcs(items: DeadlineRef[], name: string) {
  const blob = new Blob([buildIcs(items)], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
