import type { Contract, Conversation, Party, Profile } from '../types'
import { getTemplate } from '../data/templates'
import { DEFAULT_ANSWERS, generateClauses, type WizardAnswers } from '../lib/contractGenerator'
import { uid } from '../lib/utils'

export const DEFAULT_PROFILE: Profile = { name: 'Katarzyna Zielińska', email: 'katarzyna.zielinska@example.com' }

const ago = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString()

function party(id: 'A' | 'B', role: string, kind: Party['kind'], name: string, extra: Partial<Party> = {}): Party {
  return { id, role, kind, name, idNumber: '', address: '', email: '', representative: '', ...extra }
}

function base(templateId: string, title: string, parties: [Party, Party], answers: Partial<WizardAnswers>, createdHoursAgo: number): Contract {
  const t = getTemplate(templateId)!
  const clauses = generateClauses(t, parties, { ...DEFAULT_ANSWERS, ...answers })
  const createdAt = ago(createdHoursAgo)
  return {
    id: uid('k'),
    title,
    templateId,
    source: 'template',
    createdAt,
    updatedAt: createdAt,
    stage: 'draft',
    ownerPartyId: 'A',
    parties,
    clauses,
    proposals: [],
    comments: [],
    versions: [{ id: uid('v'), number: 1, createdAt, authorName: DEFAULT_PROFILE.name, note: 'Utworzono projekt z kreatora', clauses: clauses.map((c) => ({ ...c })) }],
    signatures: [],
    acceptedBy: {},
    privateChats: {},
    activity: [{ id: uid('a'), at: createdAt, text: 'Utworzono projekt umowy', partyId: 'A' }],
  }
}

export function seedContracts(): Contract[] {
  const me = DEFAULT_PROFILE.name

  // 1. Usługi marketingowe – kontrahent zaproponował zmianę (wymaga Twojej odpowiedzi)
  const c1 = base(
    'marketing',
    'Obsługa marketingowa – Zielona Łąka',
    [
      party('A', 'Klient', 'firma', 'Zielona Łąka sp. z o.o.', { address: 'ul. Ogrodowa 8, 00-876 Warszawa', idNumber: '5250000000', representative: me, email: DEFAULT_PROFILE.email }),
      party('B', 'Agencja', 'firma', 'Studio Kreatywne Pixel sp. z o.o.', { address: 'ul. Mokotowska 21, 00-560 Warszawa', email: 'tomasz@pixel.example', representative: 'Tomasz Nowicki' }),
    ],
    { scope: 'prowadzenie profili Zielonej Łąki na Instagramie i Facebooku (12 postów miesięcznie) oraz kampanii reklamowych z budżetem mediowym do 3 000 zł miesięcznie', amount: '4500', amountBasis: 'miesięcznie', paymentDays: '14', startDate: '2026-12-01', notice: '1 miesiąc' },
    72,
  )
  c1.shareId = 'demo-pixel'
  c1.stage = 'shared'
  c1.invite = { name: 'Tomasz Nowicki', email: 'tomasz@pixel.example', message: 'Dzień dobry, przesyłam projekt umowy do wglądu.', sentAt: ago(70) }
  const pay = c1.clauses.find((c) => c.title.startsWith('Wynagrodzenie'))!
  c1.proposals.push({
    id: uid('p'),
    clauseId: pay.id,
    authorPartyId: 'B',
    authorName: 'Tomasz Nowicki',
    originalText: pay.text,
    newText: pay.text.replace('w terminie 14 dni od doręczenia faktury lub rachunku', 'w terminie 7 dni od doręczenia faktury lub rachunku, z góry za dany miesiąc'),
    comment: 'Pracujemy w modelu z góry – budżety reklamowe opłacamy z wyprzedzeniem. Czy 7 dni będzie w porządku?',
    status: 'open',
    createdAt: ago(5),
  })
  c1.comments.push(
    { id: uid('c'), clauseId: c1.clauses[1].id, authorPartyId: 'B', authorName: 'Tomasz Nowicki', text: 'Czy budżet mediowy 3 000 zł jest w kwocie wynagrodzenia, czy osobno? Proponuję doprecyzować, że osobno.', createdAt: ago(5) },
  )
  c1.activity.push(
    { id: uid('a'), at: ago(70), text: `${me} udostępnił(a) dokument: Tomasz Nowicki`, partyId: 'A' },
    { id: uid('a'), at: ago(26), text: 'Tomasz Nowicki otworzył(a) dokument' },
    { id: uid('a'), at: ago(5), text: 'Tomasz Nowicki zaproponował(a) zmianę: „Wynagrodzenie i płatności”', partyId: 'B' },
  )
  c1.updatedAt = ago(5)

  // 2. Najem mieszkania – Twoja propozycja czeka na drugą stronę (w negocjacjach)
  const c2 = base(
    'najem-mieszkania',
    'Najem mieszkania – ul. Polna 12/4',
    [
      party('A', 'Wynajmujący', 'osoba', me, { address: 'ul. Kwiatowa 3, 02-123 Warszawa', email: DEFAULT_PROFILE.email }),
      party('B', 'Najemca', 'osoba', 'Michał Lewandowski', { email: 'michal.l@example.com' }),
    ],
    { scope: 'mieszkanie 2-pokojowe o powierzchni 48 m², ul. Polna 12/4, Warszawa, wraz z komórką lokatorską', amount: '3200', paymentDays: '10', startDate: '2026-12-01', endDate: '2027-11-30', deposit: '3200', notice: '1 miesiąc' },
    120,
  )
  c2.shareId = 'demo-polna'
  c2.stage = 'shared'
  c2.invite = { name: 'Michał Lewandowski', email: 'michal.l@example.com', message: 'Cześć Michał, tak jak rozmawialiśmy – projekt umowy najmu.', sentAt: ago(118) }
  const notice = c2.clauses.find((c) => c.title.startsWith('Wypowiedzenie'))!
  const p2orig = notice.text
  c2.proposals.push(
    {
      id: uid('p'),
      clauseId: notice.id,
      authorPartyId: 'B',
      authorName: 'Michał Lewandowski',
      originalText: p2orig,
      newText: p2orig.replace('1 miesiąc', '1 miesiąc, przy czym Najemca może wypowiedzieć umowę w razie zmiany miejsca pracy na inne miasto'),
      comment: 'Pracuję hybrydowo i może mnie czekać przeniesienie – chciałbym mieć taką furtkę.',
      status: 'rejected',
      createdAt: ago(48),
      resolvedAt: ago(30),
      resolvedByName: me,
    },
    {
      id: uid('p'),
      clauseId: notice.id,
      authorPartyId: 'A',
      authorName: me,
      originalText: p2orig,
      newText: `${p2orig}\n4. Najemca może wcześniej rozwiązać umowę, jeżeli wskaże nowego najemcę akceptowalnego dla Wynajmującego, który przejmie umowę na dotychczasowych warunkach.`,
      comment: 'Zamiast ogólnej furtki proponuję możliwość wskazania następcy – tak będzie bezpieczniej dla nas obu.',
      status: 'open',
      createdAt: ago(29),
    },
  )
  c2.activity.push(
    { id: uid('a'), at: ago(118), text: `${me} udostępnił(a) dokument: Michał Lewandowski`, partyId: 'A' },
    { id: uid('a'), at: ago(48), text: 'Michał Lewandowski zaproponował(a) zmianę: „Wypowiedzenie i rozwiązanie umowy”', partyId: 'B' },
    { id: uid('a'), at: ago(30), text: `${me} odrzucił(a) propozycję: „Wypowiedzenie i rozwiązanie umowy”`, partyId: 'A' },
    { id: uid('a'), at: ago(29), text: `${me} zaproponował(a) zmianę: „Wypowiedzenie i rozwiązanie umowy”`, partyId: 'A' },
  )
  c2.updatedAt = ago(29)

  // 3. Umowa o dzieło – uzgodniona, gotowa do podpisu
  const c3 = base(
    'dzielo-prawa',
    'Projekt logo – Pracownia Glina',
    [
      party('A', 'Zamawiający', 'firma', 'Pracownia Glina Katarzyna Zielińska', { address: 'ul. Długa 5, 31-147 Kraków', idNumber: '6760000000', representative: me, email: DEFAULT_PROFILE.email }),
      party('B', 'Twórca', 'osoba', 'Ola Mazur', { email: 'ola.mazur@example.com', address: 'Kraków' }),
    ],
    { scope: 'zaprojektowanie logo pracowni ceramiki w 3 wariantach kolorystycznych wraz z prostą księgą znaku (PDF, SVG, PNG)', amount: '3800', amountBasis: 'ryczałt', paymentDays: '7', startDate: '2026-11-10', endDate: '2026-12-15', confidentiality: false },
    300,
  )
  c3.shareId = 'demo-glina'
  c3.stage = 'agreed'
  c3.invite = { name: 'Ola Mazur', email: 'ola.mazur@example.com', message: '', sentAt: ago(290) }
  const ipCl = c3.clauses.find((c) => c.title.startsWith('Prawa'))!
  const p3new = `${ipCl.text}\n3. Twórca może pokazać projekt w swoim portfolio po jego publicznym wykorzystaniu przez Zamawiającego.`
  c3.proposals.push({ id: uid('p'), clauseId: ipCl.id, authorPartyId: 'B', authorName: 'Ola Mazur', originalText: ipCl.text, newText: p3new, comment: 'Prośba o możliwość pokazania projektu w portfolio.', status: 'accepted', createdAt: ago(200), resolvedAt: ago(190), resolvedByName: me })
  ipCl.text = p3new
  c3.versions.push({ id: uid('v'), number: 2, createdAt: ago(190), authorName: me, note: 'Przyjęto zmianę: „Prawa do rezultatów prac” (autor: Ola Mazur)', clauses: c3.clauses.map((c) => ({ ...c })) })
  c3.acceptedBy = { A: { at: ago(26), version: 2 }, B: { at: ago(24), version: 2 } }
  c3.activity.push(
    { id: uid('a'), at: ago(200), text: 'Ola Mazur zaproponował(a) zmianę: „Prawa do rezultatów prac”', partyId: 'B' },
    { id: uid('a'), at: ago(190), text: `${me} zaakceptował(a) propozycję: „Prawa do rezultatów prac”`, partyId: 'A' },
    { id: uid('a'), at: ago(26), text: `${me} zaakceptował(a) wersję 2`, partyId: 'A' },
    { id: uid('a'), at: ago(24), text: 'Ola Mazur zaakceptował(a) wersję 2', partyId: 'B' },
    { id: uid('a'), at: ago(24), text: 'Obie strony uzgodniły treść umowy' },
  )
  c3.updatedAt = ago(24)

  // 4. NDA – szkic
  const c4 = base(
    'nda-wzajemna',
    'NDA – rozmowy z inwestorem',
    [
      party('A', 'Strona ujawniająca', 'firma', 'Zielona Łąka sp. z o.o.', { representative: me, email: DEFAULT_PROFILE.email }),
      party('B', 'Strona otrzymująca', 'firma', 'Fundusz Północ ASI sp. z o.o.'),
    ],
    { scope: 'rozmowy dotyczące możliwej inwestycji w rozwój sieci sklepów Zielona Łąka', startDate: '2026-11-05', endDate: '2028-11-05', penalty: 'Kwotowa kara za naruszenie poufności' },
    3,
  )

  return [c1, c2, c3, c4]
}

export function seedConversations(): Conversation[] {
  return []
}
