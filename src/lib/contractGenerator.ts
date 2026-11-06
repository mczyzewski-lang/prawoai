import type { Clause, Party } from '../types'
import type { FieldKey, TemplateDefinition } from '../data/templates'
import { formatDate, formatMoney, uid } from './utils'

export interface WizardAnswers {
  scope: string
  amount: string
  amountBasis: 'ryczałt' | 'miesięcznie' | 'za godzinę'
  paymentDays: string
  startDate: string
  endDate: string
  liability: string
  notice: string
  ip: string
  confidentiality: boolean
  penalty: string
  deposit: string
  extra: string
}

export const DEFAULT_ANSWERS: WizardAnswers = {
  scope: '',
  amount: '',
  amountBasis: 'ryczałt',
  paymentDays: '14',
  startDate: '',
  endDate: '',
  liability: 'Do wysokości wynagrodzenia z umowy',
  notice: '1 miesiąc',
  ip: 'Przeniesienie praw po zapłacie wynagrodzenia',
  confidentiality: true,
  penalty: 'Brak kar umownych',
  deposit: '',
  extra: '',
}

export const FIELD_LABELS: Record<FieldKey, string> = {
  scope: 'Zakres / przedmiot umowy',
  amount: 'Wynagrodzenie (zł)',
  amountBasis: 'Sposób rozliczenia',
  paymentDays: 'Termin płatności (dni)',
  startDate: 'Data rozpoczęcia',
  endDate: 'Termin zakończenia / wykonania',
  liability: 'Odpowiedzialność',
  notice: 'Wypowiedzenie',
  ip: 'Prawa do rezultatów',
  confidentiality: 'Poufność',
  penalty: 'Kary umowne',
  deposit: 'Kaucja (zł)',
  extra: 'Dodatkowe ustalenia',
}

export const LIABILITY_OPTIONS = ['Do wysokości wynagrodzenia z umowy', 'Do 3-krotności wynagrodzenia z umowy', 'Na zasadach ogólnych (bez limitu)']
export const NOTICE_OPTIONS = ['7 dni', '14 dni', '1 miesiąc', '3 miesiące', 'Bez możliwości wypowiedzenia (czas określony)']
export const IP_OPTIONS = ['Przeniesienie praw po zapłacie wynagrodzenia', 'Licencja niewyłączna dla zamawiającego', 'Prawa pozostają przy wykonawcy', 'Nie dotyczy']
export const PENALTY_OPTIONS = ['Brak kar umownych', '0,1% wynagrodzenia za każdy dzień opóźnienia (maks. 10%)', '10% wynagrodzenia za odstąpienie z winy strony', 'Kwotowa kara za naruszenie poufności']

export function labelFor(t: TemplateDefinition, key: FieldKey): string {
  return t.labels?.[key] ?? FIELD_LABELS[key]
}

export function partyLine(p: Party): string {
  const id = p.idNumber ? (p.kind === 'firma' ? `, NIP/KRS: ${p.idNumber}` : `, PESEL: ${p.idNumber}`) : ''
  const addr = p.address ? `, ${p.kind === 'firma' ? 'z siedzibą' : 'zamieszkała/y'}: ${p.address}` : ''
  const rep = p.kind === 'firma' && p.representative ? `, reprezentowana/y przez: ${p.representative}` : ''
  return `${p.name || '[nazwa strony]'}${addr}${id}${rep} – zwana/y dalej „${p.role}”`
}

const has = (t: TemplateDefinition, f: FieldKey) => t.fields.includes(f)

/**
 * Składa PRZYKŁADOWY projekt umowy z ogólnych klauzul.
 * To nie jest zweryfikowany wzór prawny – treść wymaga przeglądu przez prawnika.
 */
export function generateClauses(t: TemplateDefinition, parties: [Party, Party], a: WizardAnswers): Clause[] {
  const [A, B] = parties
  const clauses: Clause[] = []
  const add = (title: string, text: string, explanation: string) =>
    clauses.push({ id: uid('cl'), title, text, explanation })

  add(
    'Strony umowy',
    `Umowa zostaje zawarta pomiędzy:\n1) ${partyLine(A)},\n2) ${partyLine(B)},\nzwanymi dalej łącznie „Stronami”.`,
    'Dokładne dane stron pozwalają jednoznacznie ustalić, kto ma prawa i obowiązki z umowy. Przy firmach warto sprawdzić dane w rejestrze i to, kto może ją reprezentować.',
  )

  const subj = a.scope.trim().replace(/[.\s]+$/, '') || `[opisz ${labelFor(t, 'scope').toLowerCase()}]`
  add(
    'Przedmiot umowy',
    `1. Przedmiotem umowy jest: ${subj}.\n2. Szczegółowy zakres może zostać doprecyzowany w załącznikach lub w korespondencji e-mail zaakceptowanej przez obie Strony.`,
    'To najważniejszy zapis – im dokładniej opisany zakres, tym mniej sporów o to, co miało zostać zrobione lub przekazane. Unikaj ogólników typu „pełna obsługa”.',
  )

  if (has(t, 'startDate') || has(t, 'endDate')) {
    const start = a.startDate ? formatDate(a.startDate) : 'dnia podpisania umowy'
    const end = a.endDate ? formatDate(a.endDate) : null
    const endLabel = labelFor(t, 'endDate').toLowerCase()
    add(
      'Czas trwania i terminy',
      `1. Umowa obowiązuje od ${start}${end ? ` do ${end}` : ' na czas nieokreślony'}.\n2. ${end ? `Termin (${endLabel}) przypada na ${end}.` : 'Terminy poszczególnych etapów Strony mogą ustalać w formie e-mail.'}\n3. Strona, która przewiduje opóźnienie, niezwłocznie informuje o tym drugą Stronę wraz z podaniem przyczyny.`,
      'Termin określa, kiedy obowiązki muszą zostać wykonane. Umowa na czas nieokreślony zwykle wymaga zapisu o wypowiedzeniu, a na czas określony – jasnej daty końca.',
    )
  }

  if (has(t, 'amount')) {
    const amountLabel = labelFor(t, 'amount').replace(/\s*\(.*\)/, '')
    const basis = has(t, 'amountBasis') ? ` (${a.amountBasis})` : ''
    const days = a.paymentDays || '14'
    const depositPart =
      has(t, 'deposit') && a.deposit
        ? `\n4. Najemca wpłaci kaucję w wysokości ${formatMoney(a.deposit)}, która zostanie zwrócona po zakończeniu umowy, po potrąceniu ewentualnych udokumentowanych należności.`
        : ''
    const isLoan = t.category === 'rozliczenia'
    add(
      isLoan ? 'Kwota i zasady spłaty' : 'Wynagrodzenie i płatności',
      isLoan
        ? `1. ${amountLabel} wynosi ${formatMoney(a.amount)}.\n2. Kwota zostanie przekazana przelewem na rachunek wskazany przez Stronę.\n3. Zwrot lub spłata nastąpi ${a.endDate ? `do dnia ${formatDate(a.endDate)}` : 'w terminie ustalonym przez Strony'}, zgodnie z opisanym sposobem spłaty. Za dzień zapłaty uznaje się dzień uznania rachunku.`
        : `1. ${amountLabel} wynosi ${formatMoney(a.amount)}${basis}.\n2. Płatność nastąpi przelewem w terminie ${days} dni od doręczenia faktury lub rachunku.\n3. Za dzień zapłaty uznaje się dzień obciążenia rachunku płacącego.${depositPart}`,
      'Kwota, sposób i termin płatności powinny być jednoznaczne. Sprawdź, czy kwota jest netto czy brutto, oraz od kiedy liczy się termin zapłaty.',
    )
  }

  add(
    'Obowiązki stron',
    `1. ${A.role} zobowiązuje się w szczególności: ${t.duties[0].join('; ')}.\n2. ${B.role} zobowiązuje się w szczególności: ${t.duties[1].join('; ')}.\n3. Strony współdziałają w dobrej wierze w celu wykonania umowy.`,
    'Wypisanie obowiązków obu stron pokazuje, czego każda z nich może oczekiwać. Dodaj obowiązki specyficzne dla Waszej sytuacji, np. godziny dostępności albo sposób przekazywania materiałów.',
  )

  if (has(t, 'ip') && a.ip !== 'Nie dotyczy') {
    const ipText: Record<string, string> = {
      'Przeniesienie praw po zapłacie wynagrodzenia': `1. Z chwilą zapłaty całości wynagrodzenia autorskie prawa majątkowe do rezultatów prac przechodzą na ${A.role} na polach eksploatacji wskazanych w załączniku.\n2. Do czasu zapłaty ${A.role} może korzystać z rezultatów wyłącznie w celu ich odbioru i oceny.`,
      'Licencja niewyłączna dla zamawiającego': `1. ${B.role} udziela ${A.role} niewyłącznej licencji na korzystanie z rezultatów prac na polach eksploatacji wskazanych w załączniku.\n2. Licencja zostaje udzielona na czas oznaczony wskazany w załączniku, na terytorium Polski, chyba że Strony postanowią inaczej.`,
      'Prawa pozostają przy wykonawcy': `1. Autorskie prawa majątkowe do rezultatów prac pozostają przy ${B.role}.\n2. ${A.role} może korzystać z rezultatów wyłącznie w zakresie niezbędnym do realizacji celu umowy.`,
    }
    add(
      'Prawa do rezultatów prac',
      ipText[a.ip] ?? ipText['Przeniesienie praw po zapłacie wynagrodzenia'],
      'Jeśli rezultatem jest utwór (tekst, grafika, kod, zdjęcia), umowa powinna jasno określić, kto i w jakim zakresie może z niego korzystać. Pola eksploatacji trzeba wymienić konkretnie.',
    )
  }

  if ((has(t, 'confidentiality') && a.confidentiality) || t.category === 'ip') {
    add(
      'Poufność',
      `1. Strony zachowają w poufności informacje uzyskane w związku z umową, które nie są publicznie dostępne.\n2. Obowiązek poufności trwa przez czas obowiązywania umowy oraz ${t.id.startsWith('nda') && a.endDate ? `do dnia ${formatDate(a.endDate)}` : '2 lata po jej zakończeniu'}.\n3. Obowiązek nie dotyczy informacji, których ujawnienia wymagają przepisy prawa lub uprawniony organ.`,
      'Zapis o poufności chroni informacje biznesowe i prywatne. Warto określić, jak długo obowiązuje i jakie są wyjątki.',
    )
  }

  if (has(t, 'penalty') && a.penalty !== 'Brak kar umownych') {
    add(
      'Kary umowne',
      `1. Strony ustalają karę umowną: ${a.penalty.toLowerCase()}.\n2. Kara jest należna wyłącznie w przypadku okoliczności, za które odpowiada zobowiązana Strona.\n3. Strona uprawniona może dochodzić odszkodowania przewyższającego wysokość kary na zasadach ogólnych.`,
      'Kara umowna to z góry ustalona kwota za konkretne naruszenie. Powinna być proporcjonalna – zbyt wysoka może zostać zakwestionowana, a zbyt niska nie motywuje.',
    )
  }

  if (has(t, 'liability')) {
    const liab: Record<string, string> = {
      'Do wysokości wynagrodzenia z umowy': 'Całkowita odpowiedzialność każdej ze Stron z tytułu umowy jest ograniczona do wysokości wynagrodzenia należnego na jej podstawie, z wyjątkiem szkód wyrządzonych umyślnie.',
      'Do 3-krotności wynagrodzenia z umowy': 'Całkowita odpowiedzialność każdej ze Stron z tytułu umowy jest ograniczona do trzykrotności wynagrodzenia należnego na jej podstawie, z wyjątkiem szkód wyrządzonych umyślnie.',
      'Na zasadach ogólnych (bez limitu)': 'Strony odpowiadają za niewykonanie lub nienależyte wykonanie umowy na zasadach ogólnych.',
    }
    add(
      'Odpowiedzialność',
      `1. ${liab[a.liability] ?? liab['Do wysokości wynagrodzenia z umowy']}\n2. Żadna ze Stron nie odpowiada za opóźnienia spowodowane okolicznościami, na które nie miała wpływu i których nie mogła przewidzieć.`,
      'Ograniczenie odpowiedzialności zmniejsza ryzyko ogromnych roszczeń, ale może też ograniczyć Twoją ochronę. Sprawdź, czy limit jest wzajemny i czy obejmuje szkody umyślne.',
    )
  }

  if (has(t, 'notice')) {
    const fixed = a.notice.startsWith('Bez')
    add(
      'Wypowiedzenie i rozwiązanie umowy',
      fixed
        ? `1. Umowa została zawarta na czas określony i nie przewiduje wypowiedzenia, z zastrzeżeniem ust. 2.\n2. Każda ze Stron może rozwiązać umowę bez zachowania okresu wypowiedzenia, jeśli druga Strona rażąco narusza jej postanowienia i nie usunie naruszenia w terminie 7 dni od wezwania.`
        : `1. Każda ze Stron może wypowiedzieć umowę z zachowaniem okresu wypowiedzenia wynoszącego ${a.notice}, ze skutkiem na koniec miesiąca kalendarzowego.\n2. Każda ze Stron może rozwiązać umowę bez zachowania okresu wypowiedzenia, jeśli druga Strona rażąco narusza jej postanowienia i nie usunie naruszenia w terminie 7 dni od wezwania.\n3. Wypowiedzenie wymaga formy pisemnej lub elektronicznej (e-mail na adres wskazany w umowie).`,
      'Zapis o wypowiedzeniu mówi, jak i kiedy można zakończyć współpracę. Zadbaj, by warunki były symetryczne i by wiadomo było, jak rozliczyć pracę wykonaną przed końcem umowy.',
    )
  }

  if (a.extra.trim()) {
    add('Dodatkowe ustalenia', a.extra.trim(), 'Indywidualne ustalenia stron. Sprawdź, czy nie są sprzeczne z pozostałymi zapisami.')
  }

  add(
    'Postanowienia końcowe',
    `1. Zmiany umowy wymagają zgody obu Stron wyrażonej w tej samej formie co umowa.\n2. W sprawach nieuregulowanych stosuje się przepisy prawa polskiego.\n3. Spory Strony będą starały się rozwiązać polubownie, a w razie braku porozumienia – przed sądem właściwym według przepisów ogólnych.\n4. Umowę sporządzono w formie dokumentu podpisanego przez obie Strony.`,
    'Postanowienia końcowe porządkują sposób zmiany umowy i rozwiązywania sporów. Zwróć uwagę, czy nie wskazują sądu wygodnego tylko dla jednej strony.',
  )

  return clauses
}

/** Tekst całej umowy (np. do skrótu dokumentu lub eksportu). */
export function clausesToText(title: string, clauses: Clause[]): string {
  return [title.toUpperCase(), '', ...clauses.map((c, i) => `§ ${i + 1}. ${c.title}\n${c.text}`)].join('\n\n')
}
