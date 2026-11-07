import type { DebtCase, DebtInvoice, DebtStatus, SavedParty } from '../types'
import { daysUntil, fromYmd, todayYmd } from './deadlines'

/**
 * Parametry wyliczeń – do aktualizacji, gdy zmieni się stopa referencyjna NBP lub kurs EUR.
 * Wyliczenia są szacunkowe; w wezwaniu podajemy je jako „odsetki do dnia sporządzenia wezwania”.
 */
export const RATES = {
  /** Stopa referencyjna NBP (%) przyjęta do wyliczeń. */
  nbpReference: 4.5,
  /** Odsetki za opóźnienie w transakcjach handlowych = stopa referencyjna + 10 p.p. */
  commercialMargin: 10,
  /** Odsetki ustawowe za opóźnienie = stopa referencyjna + 5,5 p.p. */
  statutoryMargin: 5.5,
  /** Kurs EUR do przeliczenia rekompensaty za koszty odzyskania należności. */
  eurPln: 4.25,
}

export const STATUS_LABEL: Record<DebtStatus, string> = {
  nowa: 'Nowa',
  przypomnienie: 'Przypomnienie wysłane',
  wezwanie: 'Wezwanie wysłane',
  ugoda: 'Ugoda / plan spłaty',
  spłacona: 'Spłacona',
  'u prawnika': 'U prawnika',
}
export const STATUS_ORDER: DebtStatus[] = ['nowa', 'przypomnienie', 'wezwanie', 'ugoda', 'spłacona']

export const zl = (n: number) => `${n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`

export function annualRate(b2b: boolean): number {
  return RATES.nbpReference + (b2b ? RATES.commercialMargin : RATES.statutoryMargin)
}

/** Rekompensata za koszty odzyskania należności (B2B) – równowartość 40/70/100 EUR zależnie od kwoty. */
export function compensationEur(amount: number): number {
  if (amount < 5000) return 40
  if (amount <= 50000) return 70
  return 100
}

export interface InvoiceCalc {
  inv: DebtInvoice
  daysLate: number
  interest: number
  compensation: number
}

export interface CaseCalc {
  rows: InvoiceCalc[]
  principal: number
  interest: number
  compensation: number
  total: number
  maxDaysLate: number
  rate: number
  /** Najwcześniejszy dzień przedawnienia (B2B: 3 lata, koniec roku kalendarzowego). */
  limitation: string | null
  limitationDays: number | null
}

export function calcCase(c: DebtCase, today = todayYmd()): CaseCalc {
  const rate = annualRate(c.b2b)
  const rows = c.invoices.map((inv) => {
    const daysLate = Math.max(0, -daysUntil(inv.dueDate, today))
    const interest = Math.round(inv.amount * (rate / 100) * (daysLate / 365) * 100) / 100
    const compensation = c.b2b && daysLate > 0 ? Math.round(compensationEur(inv.amount) * RATES.eurPln * 100) / 100 : 0
    return { inv, daysLate, interest, compensation }
  })
  const principal = rows.reduce((n, r) => n + r.inv.amount, 0)
  const interest = rows.reduce((n, r) => n + r.interest, 0)
  const compensation = rows.reduce((n, r) => n + r.compensation, 0)
  // przedawnienie roszczeń z działalności: 3 lata, upływ w ostatnim dniu roku kalendarzowego
  const earliest = [...c.invoices].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
  let limitation: string | null = null
  if (earliest) {
    const due = fromYmd(earliest.dueDate)
    const years = c.b2b ? 3 : 6
    limitation = `${due.getFullYear() + years}-12-31`
  }
  return {
    rows,
    principal,
    interest: Math.round(interest * 100) / 100,
    compensation: Math.round(compensation * 100) / 100,
    total: Math.round((principal + interest + compensation) * 100) / 100,
    maxDaysLate: Math.max(0, ...rows.map((r) => r.daysLate)),
    rate,
    limitation,
    limitationDays: limitation ? daysUntil(limitation, today) : null,
  }
}

export interface Recommendation {
  step: 'przypomnienie' | 'wezwanie' | 'prawnik' | 'czekaj'
  title: string
  why: string
}

/** Rekomendacja kolejnego kroku (reguły – do zastąpienia/uzupełnienia oceną AI). */
export function recommend(c: DebtCase, calc: CaseCalc): Recommendation {
  if (c.status === 'spłacona') return { step: 'czekaj', title: 'Sprawa zamknięta', why: 'Należność została spłacona.' }
  if (c.status === 'u prawnika') return { step: 'czekaj', title: 'Sprawa u prawnika', why: 'Kolejne kroki prowadzi prawnik.' }
  if (calc.maxDaysLate === 0) return { step: 'czekaj', title: 'Termin płatności jeszcze nie minął', why: 'Przypomnienie wyślesz, gdy faktura stanie się wymagalna.' }
  if (c.disputed) return { step: 'prawnik', title: 'Skonsultuj sprawę z prawnikiem', why: 'Dłużnik kwestionuje należność – zanim wyślesz wezwanie, warto ocenić dowody i ryzyko sporu.' }
  if (calc.limitationDays !== null && calc.limitationDays < 180) return { step: 'prawnik', title: 'Pilne: zbliża się przedawnienie', why: 'Do przedawnienia zostało mniej niż pół roku – warto od razu przekazać sprawę prawnikowi.' }
  if (c.status === 'wezwanie' || calc.principal > 50000 || calc.maxDaysLate > 90) return { step: 'prawnik', title: 'Rozważ przekazanie sprawy prawnikowi', why: c.status === 'wezwanie' ? 'Wezwanie zostało wysłane – jeśli termin w nim minął bez zapłaty, kolejny krok to pozew.' : 'Duża kwota lub długie opóźnienie – skuteczniejsze będzie działanie przez kancelarię.' }
  if (c.status === 'przypomnienie' || calc.maxDaysLate > 14) return { step: 'wezwanie', title: 'Wyślij wezwanie do zapłaty', why: 'Przypomnienie nie wystarczyło albo opóźnienie przekracza 2 tygodnie – formalne wezwanie z odsetkami i terminem 7 dni.' }
  return { step: 'przypomnienie', title: 'Zacznij od uprzejmego przypomnienia', why: 'Krótkie opóźnienie – często wystarczy przypomnienie z numerem faktury i kontem.' }
}

const fmtDate = (ymd: string) => fromYmd(ymd).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })

export function reminderText(c: DebtCase, creditorName: string): string {
  const list = c.invoices.map((i) => `${i.number || 'faktura'} na kwotę ${zl(i.amount)} (termin ${fmtDate(i.dueDate)})`).join(', ')
  return `Dzień dobry,\n\nuprzejmie przypominamy o płatności: ${list}. Do dziś nie odnotowaliśmy wpłaty.${c.account ? `\n\nNumer rachunku: ${c.account}` : ''}\n\nJeśli płatność została już zlecona – prosimy potraktować tę wiadomość jako nieaktualną. W razie pytań chętnie porozmawiamy.\n\nPozdrawiamy,\n${creditorName}`
}

/** Treść przedsądowego wezwania do zapłaty. */
export function demandText(c: DebtCase, calc: CaseCalc, creditor: SavedParty, payDays = 7): { title: string; paragraphs: string[] } {
  const today = fmtDate(todayYmd())
  const lines = calc.rows.map((r) => `– ${r.inv.number || 'faktura'}: ${zl(r.inv.amount)}, termin płatności ${fmtDate(r.inv.dueDate)} (opóźnienie ${r.daysLate} dni), odsetki ${zl(r.interest)}${r.compensation ? `, rekompensata ${zl(r.compensation)}` : ''}`)
  return {
    title: 'PRZEDSĄDOWE WEZWANIE DO ZAPŁATY',
    paragraphs: [
      `${creditor.address ? `${creditor.address.replace(/\n/g, ', ')}, ` : ''}${today}`,
      `Wierzyciel: ${creditor.name}${creditor.idNumber ? `, ${creditor.kind === 'firma' ? 'NIP' : 'PESEL'} ${creditor.idNumber}` : ''}${creditor.address ? `, ${creditor.address.replace(/\n/g, ', ')}` : ''}`,
      `Dłużnik: ${c.debtor.name}${c.debtor.idNumber ? `, ${c.debtor.kind === 'firma' ? 'NIP' : 'PESEL'} ${c.debtor.idNumber}` : ''}${c.debtor.address ? `, ${c.debtor.address.replace(/\n/g, ', ')}` : ''}`,
      `Wzywam do zapłaty kwoty ${zl(calc.total)}, na którą składają się:`,
      ...lines,
      `Należność główna: ${zl(calc.principal)}. Odsetki ${c.b2b ? 'za opóźnienie w transakcjach handlowych' : 'ustawowe za opóźnienie'} wyliczone do dnia ${today}: ${zl(calc.interest)}.${calc.compensation ? ` Rekompensata za koszty odzyskania należności: ${zl(calc.compensation)}.` : ''}`,
      `Kwotę należy wpłacić w terminie ${payDays} dni od dnia otrzymania niniejszego wezwania${c.account ? ` na rachunek bankowy nr ${c.account}` : ''}. Odsetki naliczane są nadal do dnia zapłaty.`,
      'Brak zapłaty w wyznaczonym terminie spowoduje skierowanie sprawy na drogę postępowania sądowego, co narazi Państwa na dodatkowe koszty, w tym koszty postępowania i zastępstwa procesowego.',
      'Jednocześnie informujemy, że jesteśmy otwarci na rozmowę o porozumieniu lub rozłożeniu należności na raty.',
      creditor.kind === 'firma' && creditor.representative ? `${creditor.name}\n${creditor.representative}` : creditor.name,
    ],
  }
}

/** Odczyt podstawowych danych z tekstu faktury (numer, kwota do zapłaty, termin płatności). */
export function parseInvoiceText(text: string): Partial<DebtInvoice> {
  const t = text.replace(/\s+/g, ' ')
  const number = t.match(/faktura(?:\s+vat)?\s*(?:nr|numer)?[:\s]*([A-Z0-9][\w/.-]{2,30})/i)?.[1]
  const amountRaw = t.match(/(?:do zapłaty|razem do zapłaty|kwota do zapłaty|razem brutto|wartość brutto)[:\s]*([\d\s.]+,\d{2})/i)?.[1] ?? t.match(/([\d\s]+,\d{2})\s*(?:zł|PLN)/i)?.[1]
  const amount = amountRaw ? Number(amountRaw.replace(/[\s.]/g, '').replace(',', '.')) : undefined
  const dm = t.match(/termin\s+płatności[:\s]*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/i) ?? t.match(/termin\s+płatności[:\s]*(\d{4})-(\d{2})-(\d{2})/i)
  let dueDate: string | undefined
  if (dm) dueDate = dm[1].length === 4 ? `${dm[1]}-${dm[2]}-${dm[3]}` : `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`
  return { number, amount: amount && !Number.isNaN(amount) ? amount : undefined, dueDate }
}

/** Drukowanie dokumentu (wezwanie) – w oknie druku można zapisać PDF. */
export function printDocument(title: string, paragraphs: string[]) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    @page { margin: 22mm 20mm; } body { font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 1.55; color: #111; }
    h1 { font-size: 14pt; text-align: center; letter-spacing: .06em; margin: 28px 0 22px; } p { margin: 0 0 10px; white-space: pre-line; }
    .r { text-align: right; } .sig { margin-top: 48px; text-align: right; }
  </style></head><body>${paragraphs
    .map((p, i) => (i === 0 ? `<p class="r">${esc(p)}</p>` : i === 2 ? `<p>${esc(p)}</p><h1>${esc(title)}</h1>` : i === paragraphs.length - 1 ? `<p class="sig">${esc(p)}</p>` : `<p>${esc(p)}</p>`))
    .join('')}</body></html>`
  const frame = document.createElement('iframe')
  frame.style.position = 'fixed'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  document.body.appendChild(frame)
  frame.contentDocument!.open()
  frame.contentDocument!.write(html)
  frame.contentDocument!.close()
  setTimeout(() => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    setTimeout(() => frame.remove(), 1000)
  }, 200)
}
