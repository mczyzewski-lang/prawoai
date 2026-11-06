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
}

export interface SharedComment {
  id: string
  clauseId: string | null
  authorPartyId: PartyId
  authorName: string
  text: string
  createdAt: string
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
  checks?: { title: string; detail: string }[]
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
  invite?: { name: string; email: string; message: string; sentAt: string }
  analysis?: AnalysisResult
  /** Prywatne rozmowy z asystentem – osobno dla każdej strony. */
  privateChats: Partial<Record<PartyId, ChatMessage[]>>
  activity: ActivityItem[]
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
