export type PartyId = 'A' | 'B'

export type PartyKind = 'osoba' | 'firma'

/** Typ relacji stron – używany do filtrowania wzorów. */
export type PartyRelation = 'b2b' | 'b2c' | 'c2c'

export interface Party {
  id: PartyId
  /** Rola w umowie, np. „Zleceniodawca”. */
  role: string
  kind: PartyKind
  name: string
  /** NIP / PESEL / KRS – w zależności od rodzaju strony. */
  idNumber: string
  address: string
  email: string
  representative: string
}

export interface Clause {
  id: string
  title: string
  text: string
  /** Wyjaśnienie zapisu prostym językiem (z kreatora). */
  explanation?: string
}

export type ProposalStatus = 'open' | 'accepted' | 'rejected' | 'withdrawn'

export interface Proposal {
  id: string
  clauseId: string
  authorPartyId: PartyId
  authorName: string
  originalText: string
  newText: string
  comment: string
  status: ProposalStatus
  createdAt: string
  resolvedAt?: string
  resolvedByName?: string
  /** Komentarze stron do sugestii (druga strona komentuje, pierwsza decyduje). */
  thread?: ProposalComment[]
  /** Ostateczne brzmienie, jeśli przy akceptacji zostało zmienione („Edytuj”). */
  finalText?: string
}

export interface ProposalComment {
  id: string
  authorPartyId: PartyId
  authorName: string
  text: string
  createdAt: string
}

export interface SharedComment {
  id: string
  clauseId: string | null
  authorPartyId: PartyId
  authorName: string
  text: string
  createdAt: string
  /** Komentarz wewnętrzny (Twój zespół / wspólnik) – niewidoczny dla drugiej strony umowy. */
  internal?: boolean
}

export type CollaboratorRole = 'komentarze' | 'podgląd'

/** Osoba z Twojej strony (np. wspólnik), której udostępniasz umowę do przeglądu przed podpisem. */
export interface Collaborator {
  id: string
  token: string
  name: string
  email: string
  role: CollaboratorRole
  invitedAt: string
  approvedAt?: string
}

export interface Version {
  id: string
  number: number
  createdAt: string
  authorName: string
  note: string
  clauses: Clause[]
}

export interface Signature {
  partyId: PartyId
  signerName: string
  dataUrl: string
  signedAt: string
  method: 'drawn' | 'typed' | 'sms'
  /** Numer telefonu (zamaskowany) – przy podpisie kodem SMS. */
  phone?: string
  /** Wersja dokumentu, którą podpisano. */
  version?: number
}

export type FindingSeverity = 'high' | 'medium' | 'low'
export type FindingStatus = 'pending' | 'accepted' | 'rejected' | 'edited'

export interface Finding {
  id: string
  /** null = brakujące postanowienie (nie jest przypięte do istniejącego zapisu). */
  clauseId: string | null
  /** Brakujące postanowienie: po którym zapisie je wstawić. */
  insertAfterClauseId?: string
  severity: FindingSeverity
  category: 'ryzyko' | 'niejasność' | 'brak' | 'termin' | 'płatność'
  title: string
  explanation: string
  suggestion: string
  /** Fragment tekstu, który wywołał uwagę. */
  excerpt?: string
  status: FindingStatus
  /** Brzmienie po edycji przez użytkownika. */
  editedText?: string
  /** Waga uwagi: „najważniejsze” vs „kosmetyka”. */
  priority?: FindingPriority
  /** Istotność 1–5 z perspektywy użytkownika. */
  importance?: number
  /** Charakter uwagi – nie tylko prawny. */
  aspect?: FindingAspect
  /** Co to oznacza w praktyce dla użytkownika. */
  impact?: string
}

export type FindingPriority = 'najważniejsze' | 'kosmetyka'
export type FindingAspect = 'prawne' | 'finansowe' | 'biznesowe' | 'operacyjne'

export interface AnalysisResult {
  createdAt: string
  summary: string
  contractType: string
  /** details – adres, NIP/KRS/PESEL, reprezentacja (jak w tekście umowy). */
  parties: { name: string; role: string; details?: string; kind?: 'osoba' | 'firma'; address?: string; idNumber?: string; representative?: string }[]
  obligations: { party: string; items: string[] }[]
  dates: { label: string; value: string }[]
  payments: { label: string; value: string }[]
  findings: Finding[]
  sourceName: string
  wordCount: number
  /** Kto wykonał ocenę: model AI czy analiza regułowa. */
  engine?: 'ai' | 'rules'
  model?: string
  /** Ogólna ocena, priorytety, sprawy do sprawdzenia i gotowa wiadomość do drugiej strony (analiza AI). */
  verdict?: string
  priorities?: string[]
  checks?: { title: string; detail: string; source?: string }[]
  negotiationMessage?: string
  /** Kontekst podany przez użytkownika przed analizą. */
  context?: string
  /** Z czyjej perspektywy wykonano ocenę. */
  perspective?: { role: string; name: string }
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: string
  /** Opcjonalne propozycje brzmienia (prywatny asystent w umowie). */
  suggestion?: { clauseId: string; text: string }
  /** Strukturalne podsumowanie (asystent AI). */
  summary?: AssistantSummary
  quickReplies?: string[]
  attachment?: { name: string; words: number }
  /** Zmiany w umowie wprowadzone przez asystenta (linki do zapisów). */
  changes?: { clauseId: string; label: string }[]
  /** Stan sprzed zmian asystenta – do cofnięcia (szkic) lub id propozycji do wycofania. */
  undo?: { clauses: Clause[]; parties: [Party, Party]; title: string } | { proposalIds: string[] }
  undone?: boolean
  /** Osoby wskazane przez @wzmianki. */
  mentions?: string[]
}

export interface AssistantSummary {
  situation: string
  steps: string[]
  documents: string[]
  lawyer: { recommended: boolean; reason: string }
}

export type ContractStage = 'draft' | 'shared' | 'agreed' | 'signed'

export interface ActivityItem {
  id: string
  at: string
  text: string
  partyId?: PartyId
  /** Wpis wewnętrzny (zespół właściciela) – niewidoczny dla drugiej strony. */
  internal?: boolean
}

export interface Contract {
  id: string
  /** Ostrzeżenie do sprawdzenia po utworzeniu (np. pozostałości danych poprzedniego kontrahenta). */
  reviewNotice?: string
  /** Użytkownik potwierdził swoje dane w umowie (dokumenty wgrane do analizy). */
  ownDataConfirmed?: boolean
  title: string
  templateId?: string
  source: 'template' | 'upload' | 'paste'
  createdAt: string
  updatedAt: string
  stage: ContractStage
  /** Strona, którą reprezentuje właściciel konta (Ty). */
  ownerPartyId: PartyId
  parties: [Party, Party]
  clauses: Clause[]
  proposals: Proposal[]
  comments: SharedComment[]
  versions: Version[]
  signatures: Signature[]
  /** Akceptacja aktualnej wersji przez strony (numer wersji). */
  acceptedBy: Partial<Record<PartyId, { at: string; version: number }>>
  shareId?: string
  invite?: { name: string; email: string; message: string; sentAt: string; phone?: string; purpose?: 'negotiate' | 'sign' }
  analysis?: AnalysisResult
  /** Prywatne rozmowy z asystentem – osobno dla każdej strony. */
  privateChats: Partial<Record<PartyId, ChatMessage[]>>
  activity: ActivityItem[]
  /** Terminy z umowy (kalendarz i przypomnienia) – widoczne tylko dla właściciela. */
  deadlines?: Deadline[]
  /** Zamówienie weryfikacji umowy przez prawnika. */
  lawyerReview?: LawyerReview
  /** Osoby z Twojej strony z dostępem do umowy (np. wspólnik). */
  collaborators?: Collaborator[]
}

export type DeadlineKind = 'płatność' | 'wypowiedzenie' | 'przedłużenie' | 'realizacja' | 'odbiór' | 'gwarancja' | 'inne'

/** Termin wynikający z umowy. `date` w formacie RRRR-MM-DD; puste, gdy termin zależy od zdarzenia (np. „7 dni od odbioru”). */
export interface Deadline {
  id: string
  title: string
  date: string
  kind: DeadlineKind
  /** Skąd termin: odczytany przez AI, z tekstu (reguły) albo dodany ręcznie. */
  source: 'ai' | 'tekst' | 'ręcznie'
  /** Data wyliczona od daty podpisania / utworzenia – warto potwierdzić. */
  approximate?: boolean
  /** Podstawa w umowie (cytat lub opis). */
  basis?: string
  clauseId?: string
  /** Przypomnienia: ile dni przed terminem. */
  remind: number[]
  done?: boolean
}

export type LawyerReviewStatus = 'zamówiona' | 'w weryfikacji' | 'gotowa'

export interface LawyerReview {
  id: string
  packageId: string
  packageName: string
  priceNet: number
  express: boolean
  note: string
  contactEmail: string
  orderedAt: string
  dueAt: string
  status: LawyerReviewStatus
}

export interface Conversation {
  id: string
  topicId: string
  title: string
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
  /** Etap rozmowy prowadzonej przez asystenta. */
  step: number
  answers: Record<string, string>
  done: boolean
  /** Rozmowę prowadzi model AI (bez sztywnego scenariusza pytań). */
  ai?: boolean
}

export interface Profile {
  name: string
  email: string
  /** Zapisane dane użytkownika jako strony umowy – do automatycznego uzupełniania. */
  ownParty?: SavedParty
  /** Jak zwracać się do użytkownika (wołacz), np. „Katarzyno”. */
  addressAs?: string
  /** Formy gramatyczne w komunikatach: żeńskie, męskie lub neutralne. Wybór użytkownika. */
  form?: GrammarForm
}

export type GrammarForm = 'f' | 'm' | 'n'

/** Własny wzór użytkownika – zapisana umowa do ponownego użycia z innym kontrahentem. */
export interface MyTemplate {
  id: string
  name: string
  createdAt: string
  templateId?: string
  ownerPartyId: PartyId
  parties: [Party, Party]
  clauses: Clause[]
}

export type SavedParty = Pick<Party, 'kind' | 'name' | 'address' | 'idNumber' | 'email' | 'representative'>

export interface GuestAccount {
  name: string
  email: string
  createdAt: string
}

/** Kolumna kolekcji w „Adresy i dane”. */
export interface DataColumn {
  id: string
  label: string
}

/** Wiersz kolekcji – `label` to nazwa używana po „@” (np. „Pompa 12kW”, „Mój adres”). */
export interface DataRow {
  id: string
  label: string
  values: Record<string, string>
}

/**
 * Kolekcja danych wielokrotnego użytku w umowach.
 * `osoby` ma stałe kolumny strony umowy (rodzaj, nazwa, adres, NIP/PESEL…); `inne` – kolumny użytkownika.
 */
export interface DataCollection {
  id: string
  name: string
  kind: 'osoby' | 'inne'
  columns: DataColumn[]
  rows: DataRow[]
}

/** Sprawa windykacyjna (należność od dłużnika). */
export type DebtStatus = 'nowa' | 'przypomnienie' | 'wezwanie' | 'ugoda' | 'spłacona' | 'u prawnika'

export interface DebtInvoice {
  id: string
  number: string
  /** Kwota brutto do zapłaty (PLN). */
  amount: number
  /** Termin płatności RRRR-MM-DD. */
  dueDate: string
}

export interface DebtEvent {
  id: string
  at: string
  kind: 'utworzono' | 'przypomnienie' | 'wezwanie' | 'wpłata' | 'status' | 'notatka'
  text: string
}

export interface DebtCase {
  id: string
  createdAt: string
  updatedAt: string
  contractId?: string
  debtor: SavedParty
  invoices: DebtInvoice[]
  /** Transakcja handlowa między przedsiębiorcami (odsetki handlowe, rekompensata). */
  b2b: boolean
  /** Dłużnik kwestionuje należność. */
  disputed: boolean
  status: DebtStatus
  /** Numer rachunku do wpłaty. */
  account: string
  events: DebtEvent[]
}
