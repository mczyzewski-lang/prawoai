import type { PartyKind, PartyRelation } from '../types'

/**
 * Katalog wzorów umów.
 *
 * Każda pozycja opisuje METADANE wzoru oraz parametry kreatora. Treść projektu
 * jest składana z ogólnych, przykładowych klauzul (src/lib/contractGenerator.ts).
 * Wszystkie pozycje mają status „przykładowy” – przed produkcyjnym użyciem każdy
 * wzór musi zostać przygotowany i zatwierdzony przez prawnika (pola `review`).
 * Struktura jest gotowa na ~100 zatwierdzonych wzorów: wystarczy dopisać kolejne
 * obiekty do tablicy TEMPLATES lub ładować je z backendu w tym samym formacie.
 */

export type CategoryId = 'b2b' | 'freelance' | 'najem' | 'sprzedaz' | 'rozliczenia' | 'ip' | 'wspolnicy'

export interface Category {
  id: CategoryId
  name: string
  short: string
  description: string
}

export const CATEGORIES: Category[] = [
  { id: 'b2b', name: 'Usługi i współpraca B2B', short: 'Usługi B2B', description: 'Stała lub projektowa współpraca między firmami.' },
  { id: 'freelance', name: 'Freelancerzy, zlecenia i dzieła', short: 'Zlecenia i dzieła', description: 'Umowy z wykonawcami, twórcami i specjalistami.' },
  { id: 'najem', name: 'Najem i nieruchomości', short: 'Najem', description: 'Mieszkania, lokale użytkowe, miejsca parkingowe.' },
  { id: 'sprzedaz', name: 'Sprzedaż i zakup', short: 'Sprzedaż', description: 'Samochody, sprzęt, towary i dostawy.' },
  { id: 'rozliczenia', name: 'Pożyczki, rozliczenia i ugody', short: 'Rozliczenia', description: 'Pożyczki, spłaty w ratach, porozumienia i ugody.' },
  { id: 'ip', name: 'Prawa autorskie, licencje i NDA', short: 'Licencje i NDA', description: 'Poufność, przeniesienie praw i licencje.' },
  { id: 'wspolnicy', name: 'Wspólnicy, inwestycje i współpraca biznesowa', short: 'Wspólnicy', description: 'Inwestycje, porozumienia wspólników, partnerstwa.' },
]

export type FieldKey =
  | 'scope'
  | 'amount'
  | 'amountBasis'
  | 'paymentDays'
  | 'startDate'
  | 'endDate'
  | 'liability'
  | 'notice'
  | 'ip'
  | 'confidentiality'
  | 'penalty'
  | 'deposit'
  | 'extra'

export interface TemplateDefinition {
  id: string
  name: string
  description: string
  category: CategoryId
  /** Role stron: [strona A, strona B]. */
  roles: [string, string]
  /** Typowy rodzaj każdej ze stron – podpowiedź w kreatorze. */
  defaultKinds: [PartyKind, PartyKind]
  relations: PartyRelation[]
  fields: FieldKey[]
  /** Nadpisane etykiety pól kreatora. */
  labels?: Partial<Record<FieldKey, string>>
  /** Podpowiedź dla pola „zakres”. */
  scopeHint: string
  /** Typowe obowiązki stron A i B (do sekcji „Obowiązki stron”). */
  duties: [string[], string[]]
  popular?: boolean
  /** Status merytoryczny wzoru. Tylko „zatwierdzony” można oferować produkcyjnie. */
  status: 'przykładowy' | 'zatwierdzony'
  review?: { reviewedBy: string; reviewedAt: string; version: string }
}

const B2B_FIELDS: FieldKey[] = ['scope', 'amount', 'amountBasis', 'paymentDays', 'startDate', 'endDate', 'liability', 'notice', 'confidentiality', 'penalty', 'extra']
const WORK_FIELDS: FieldKey[] = ['scope', 'amount', 'amountBasis', 'paymentDays', 'startDate', 'endDate', 'liability', 'notice', 'ip', 'confidentiality', 'extra']
const RENT_FIELDS: FieldKey[] = ['scope', 'amount', 'paymentDays', 'startDate', 'endDate', 'deposit', 'notice', 'liability', 'extra']
const SALE_FIELDS: FieldKey[] = ['scope', 'amount', 'paymentDays', 'endDate', 'liability', 'penalty', 'extra']
const LOAN_FIELDS: FieldKey[] = ['scope', 'amount', 'paymentDays', 'startDate', 'endDate', 'penalty', 'extra']
const IP_FIELDS: FieldKey[] = ['scope', 'amount', 'amountBasis', 'paymentDays', 'startDate', 'endDate', 'ip', 'confidentiality', 'penalty', 'liability', 'extra']
const PARTNER_FIELDS: FieldKey[] = ['scope', 'amount', 'startDate', 'endDate', 'notice', 'ip', 'confidentiality', 'liability', 'extra']

type Seed = Omit<TemplateDefinition, 'status' | 'fields' | 'duties'> & {
  fields?: FieldKey[]
  duties?: [string[], string[]]
}

const BY_CATEGORY: Record<CategoryId, { fields: FieldKey[]; duties: [string[], string[]] }> = {
  b2b: {
    fields: B2B_FIELDS,
    duties: [
      ['terminowo zapłacić wynagrodzenie', 'przekazać informacje i materiały potrzebne do realizacji usług', 'wskazać osobę do kontaktu'],
      ['wykonywać usługi starannie i zgodnie z ustalonym zakresem', 'informować o postępach i przeszkodach', 'chronić informacje otrzymane od drugiej strony'],
    ],
  },
  freelance: {
    fields: WORK_FIELDS,
    duties: [
      ['przekazać brief i materiały wejściowe', 'odebrać rezultat lub zgłosić uwagi w uzgodnionym terminie', 'zapłacić wynagrodzenie'],
      ['wykonać pracę osobiście lub za zgodą drugiej strony przy pomocy innych osób', 'dostarczyć rezultat w terminie', 'wprowadzić uzgodnione poprawki'],
    ],
  },
  najem: {
    fields: RENT_FIELDS,
    duties: [
      ['wydać przedmiot najmu w stanie przydatnym do umówionego użytku', 'dokonywać napraw, które nie obciążają najemcy', 'zapewnić spokojne korzystanie z przedmiotu najmu'],
      ['płacić czynsz i opłaty w terminie', 'używać przedmiotu najmu zgodnie z przeznaczeniem', 'zwrócić przedmiot najmu w stanie niepogorszonym ponad normalne zużycie'],
    ],
  },
  sprzedaz: {
    fields: SALE_FIELDS,
    duties: [
      ['wydać przedmiot sprzedaży wraz z dokumentami', 'poinformować o znanych wadach', 'przenieść własność na kupującego'],
      ['zapłacić cenę w ustalonym terminie', 'odebrać przedmiot sprzedaży', 'sprawdzić przedmiot przy odbiorze'],
    ],
  },
  rozliczenia: {
    fields: LOAN_FIELDS,
    duties: [
      ['przekazać ustaloną kwotę lub wykonać ustalone świadczenie', 'potwierdzać otrzymane wpłaty na prośbę drugiej strony'],
      ['spłacać kwotę w ustalonych terminach', 'informować o zmianie danych kontaktowych', 'informować o przewidywanych opóźnieniach'],
    ],
  },
  ip: {
    fields: IP_FIELDS,
    duties: [
      ['udostępnić lub przekazać utwór, know-how albo informacje', 'zapewnić, że ma prawo nimi dysponować'],
      ['korzystać z praw lub informacji wyłącznie w ustalonym zakresie', 'zapłacić wynagrodzenie, jeśli zostało ustalone', 'chronić informacje poufne'],
    ],
  },
  wspolnicy: {
    fields: PARTNER_FIELDS,
    duties: [
      ['wnieść ustalony wkład', 'działać lojalnie wobec drugiej strony', 'uczestniczyć w podejmowaniu kluczowych decyzji'],
      ['wnieść ustalony wkład', 'działać lojalnie wobec drugiej strony', 'udostępniać informacje o realizacji wspólnego przedsięwzięcia'],
    ],
  },
}

const SEEDS: Seed[] = [
  // ——— Usługi i współpraca B2B ———
  { id: 'uslugi-b2b', name: 'Umowa o świadczenie usług', description: 'Uniwersalna umowa na stałe lub projektowe usługi między firmami.', category: 'b2b', roles: ['Zleceniodawca', 'Usługodawca'], defaultKinds: ['firma', 'firma'], relations: ['b2b'], scopeHint: 'np. prowadzenie kampanii reklamowych w mediach społecznościowych', popular: true },
  { id: 'wspolpraca-b2b', name: 'Umowa o współpracy B2B (kontrakt)', description: 'Długoterminowa współpraca z jednoosobową działalnością zamiast etatu.', category: 'b2b', roles: ['Zamawiający', 'Wykonawca'], defaultKinds: ['firma', 'firma'], relations: ['b2b'], scopeHint: 'np. usługi programistyczne w projekcie aplikacji mobilnej', popular: true },
  { id: 'sla-it', name: 'Umowa serwisowa IT (SLA)', description: 'Utrzymanie systemów z czasem reakcji i poziomami dostępności.', category: 'b2b', roles: ['Klient', 'Dostawca usług'], defaultKinds: ['firma', 'firma'], relations: ['b2b'], scopeHint: 'np. utrzymanie sklepu internetowego i serwerów, reakcja do 4 godzin' },
  { id: 'marketing', name: 'Umowa o obsługę marketingową', description: 'Stała obsługa agencji: kampanie, treści, raportowanie.', category: 'b2b', roles: ['Klient', 'Agencja'], defaultKinds: ['firma', 'firma'], relations: ['b2b'], scopeHint: 'np. kampanie Google Ads i Meta, 8 postów miesięcznie, raport do 5. dnia miesiąca' },
  { id: 'ksiegowosc', name: 'Umowa o prowadzenie księgowości', description: 'Obsługa księgowa i kadrowa firmy przez biuro rachunkowe.', category: 'b2b', roles: ['Klient', 'Biuro rachunkowe'], defaultKinds: ['firma', 'firma'], relations: ['b2b'], scopeHint: 'np. pełna księgowość, do 150 dokumentów miesięcznie, deklaracje podatkowe' },
  { id: 'podwykonawstwo', name: 'Umowa podwykonawcza', description: 'Powierzenie części prac innej firmie w ramach większego projektu.', category: 'b2b', roles: ['Wykonawca główny', 'Podwykonawca'], defaultKinds: ['firma', 'firma'], relations: ['b2b'], scopeHint: 'np. wykonanie instalacji elektrycznej w budynku biurowym' },
  { id: 'dostawy-b2b', name: 'Umowa ramowa dostaw', description: 'Powtarzalne dostawy towarów na podstawie zamówień.', category: 'b2b', roles: ['Odbiorca', 'Dostawca'], defaultKinds: ['firma', 'firma'], relations: ['b2b'], scopeHint: 'np. cykliczne dostawy opakowań kartonowych na podstawie zamówień e-mail' },
  { id: 'agencyjna', name: 'Umowa agencyjna', description: 'Pośrednictwo w pozyskiwaniu klientów za prowizję.', category: 'b2b', roles: ['Dający zlecenie', 'Agent'], defaultKinds: ['firma', 'firma'], relations: ['b2b'], scopeHint: 'np. pozyskiwanie klientów na usługi fotowoltaiczne w województwie mazowieckim' },

  // ——— Freelancerzy, zlecenia i dzieła ———
  { id: 'zlecenie', name: 'Umowa zlecenia', description: 'Staranne wykonywanie czynności bez gwarancji konkretnego rezultatu.', category: 'freelance', roles: ['Zleceniodawca', 'Zleceniobiorca'], defaultKinds: ['firma', 'osoba'], relations: ['b2c', 'c2c'], scopeHint: 'np. obsługa stoiska podczas targów, 3 dni', popular: true },
  { id: 'dzielo', name: 'Umowa o dzieło', description: 'Wykonanie konkretnego, sprawdzalnego rezultatu.', category: 'freelance', roles: ['Zamawiający', 'Wykonawca'], defaultKinds: ['firma', 'osoba'], relations: ['b2c', 'c2c', 'b2b'], scopeHint: 'np. zaprojektowanie logo i księgi znaku w 3 wariantach', popular: true },
  { id: 'dzielo-prawa', name: 'Umowa o dzieło z przeniesieniem praw autorskich', description: 'Dzieło twórcze z określeniem pól eksploatacji.', category: 'freelance', roles: ['Zamawiający', 'Twórca'], defaultKinds: ['firma', 'osoba'], relations: ['b2c', 'b2b'], scopeHint: 'np. sesja zdjęciowa produktów do sklepu internetowego, 40 zdjęć' },
  { id: 'freelance-it', name: 'Umowa z programistą freelancerem', description: 'Wykonanie oprogramowania z odbiorami etapów i kodem źródłowym.', category: 'freelance', roles: ['Zamawiający', 'Programista'], defaultKinds: ['firma', 'firma'], relations: ['b2b', 'b2c'], scopeHint: 'np. wykonanie panelu administracyjnego w React, 3 etapy z odbiorami' },
  { id: 'copywriting', name: 'Umowa na teksty i copywriting', description: 'Tworzenie treści z terminami, poprawkami i prawami do tekstów.', category: 'freelance', roles: ['Zamawiający', 'Autor'], defaultKinds: ['firma', 'osoba'], relations: ['b2c', 'b2b'], scopeHint: 'np. 10 artykułów blogowych po ok. 8 000 znaków miesięcznie' },
  { id: 'remont', name: 'Umowa o wykonanie remontu', description: 'Prace remontowe z kosztorysem, terminami i odbiorem.', category: 'freelance', roles: ['Inwestor', 'Wykonawca'], defaultKinds: ['osoba', 'firma'], relations: ['b2c', 'c2c'], scopeHint: 'np. remont łazienki 6 m², z materiałami wykonawcy według kosztorysu', popular: true },
  { id: 'fotograf', name: 'Umowa z fotografem lub filmowcem', description: 'Reportaż z wydarzenia, terminy oddania materiałów i licencja.', category: 'freelance', roles: ['Klient', 'Fotograf'], defaultKinds: ['osoba', 'firma'], relations: ['b2c', 'c2c'], scopeHint: 'np. reportaż ślubny, 10 godzin, min. 400 zdjęć w ciągu 30 dni' },
  { id: 'korepetycje', name: 'Umowa o korepetycje lub szkolenie', description: 'Zajęcia indywidualne lub grupowe z harmonogramem.', category: 'freelance', roles: ['Uczestnik', 'Prowadzący'], defaultKinds: ['osoba', 'osoba'], relations: ['c2c', 'b2c'], scopeHint: 'np. 20 godzin zajęć z matematyki przed maturą' },

  // ——— Najem i nieruchomości ———
  { id: 'najem-mieszkania', name: 'Umowa najmu mieszkania', description: 'Najem lokalu mieszkalnego z kaucją i protokołem.', category: 'najem', roles: ['Wynajmujący', 'Najemca'], defaultKinds: ['osoba', 'osoba'], relations: ['c2c', 'b2c'], labels: { amount: 'Czynsz miesięczny (zł)', scope: 'Opis lokalu' }, scopeHint: 'np. mieszkanie 2-pokojowe, 48 m², ul. Polna 12/4, Warszawa, z miejscem w komórce lokatorskiej', popular: true },
  { id: 'najem-okazjonalny', name: 'Umowa najmu okazjonalnego', description: 'Najem mieszkania z dodatkowymi zabezpieczeniami dla właściciela.', category: 'najem', roles: ['Wynajmujący', 'Najemca'], defaultKinds: ['osoba', 'osoba'], relations: ['c2c'], labels: { amount: 'Czynsz miesięczny (zł)', scope: 'Opis lokalu' }, scopeHint: 'np. mieszkanie 3-pokojowe, 62 m², Kraków' },
  { id: 'najem-lokalu', name: 'Umowa najmu lokalu użytkowego', description: 'Najem biura, sklepu lub magazynu dla firmy.', category: 'najem', roles: ['Wynajmujący', 'Najemca'], defaultKinds: ['firma', 'firma'], relations: ['b2b'], labels: { amount: 'Czynsz miesięczny netto (zł)', scope: 'Opis lokalu i przeznaczenie' }, scopeHint: 'np. lokal usługowy 85 m² na parterze, przeznaczenie: kawiarnia' },
  { id: 'najem-pokoju', name: 'Umowa najmu pokoju', description: 'Pokój w mieszkaniu współdzielonym z zasadami korzystania z części wspólnych.', category: 'najem', roles: ['Wynajmujący', 'Najemca'], defaultKinds: ['osoba', 'osoba'], relations: ['c2c'], labels: { amount: 'Czynsz miesięczny (zł)', scope: 'Opis pokoju' }, scopeHint: 'np. pokój 14 m² z dostępem do kuchni i łazienki' },
  { id: 'najem-parking', name: 'Umowa najmu miejsca parkingowego', description: 'Miejsce postojowe lub garaż z dostępem i opłatami.', category: 'najem', roles: ['Wynajmujący', 'Najemca'], defaultKinds: ['osoba', 'osoba'], relations: ['c2c', 'b2c'], labels: { amount: 'Opłata miesięczna (zł)', scope: 'Opis miejsca' }, scopeHint: 'np. miejsce nr 27 w hali garażowej, poziom -1' },
  { id: 'dzierzawa', name: 'Umowa dzierżawy gruntu', description: 'Korzystanie z gruntu i pobieranie z niego pożytków.', category: 'najem', roles: ['Wydzierżawiający', 'Dzierżawca'], defaultKinds: ['osoba', 'firma'], relations: ['c2c', 'b2c', 'b2b'], labels: { amount: 'Czynsz dzierżawny (zł)', scope: 'Opis gruntu' }, scopeHint: 'np. działka rolna nr 112/3, 2,4 ha' },
  { id: 'uzyczenie', name: 'Umowa użyczenia', description: 'Nieodpłatne korzystanie z rzeczy lub lokalu.', category: 'najem', roles: ['Użyczający', 'Biorący w używanie'], defaultKinds: ['osoba', 'osoba'], relations: ['c2c', 'b2c', 'b2b'], fields: ['scope', 'startDate', 'endDate', 'notice', 'liability', 'extra'], labels: { scope: 'Przedmiot użyczenia' }, scopeHint: 'np. lokal na potrzeby siedziby firmy członka rodziny' },
  { id: 'rezerwacyjna', name: 'Umowa rezerwacyjna nieruchomości', description: 'Rezerwacja mieszkania przed umową przedwstępną.', category: 'najem', roles: ['Sprzedający', 'Rezerwujący'], defaultKinds: ['osoba', 'osoba'], relations: ['c2c', 'b2c'], fields: ['scope', 'amount', 'endDate', 'penalty', 'extra'], labels: { amount: 'Opłata rezerwacyjna (zł)', scope: 'Opis nieruchomości' }, scopeHint: 'np. mieszkanie przy ul. Leśnej 5, cena 690 000 zł' },

  // ——— Sprzedaż i zakup ———
  { id: 'sprzedaz-samochodu', name: 'Umowa sprzedaży samochodu', description: 'Sprzedaż pojazdu z opisem stanu technicznego i przekazaniem dokumentów.', category: 'sprzedaz', roles: ['Sprzedający', 'Kupujący'], defaultKinds: ['osoba', 'osoba'], relations: ['c2c', 'b2c'], labels: { amount: 'Cena (zł)', scope: 'Opis pojazdu' }, scopeHint: 'np. Toyota Corolla 2018, VIN …, przebieg 98 000 km', popular: true },
  { id: 'sprzedaz-rzeczy', name: 'Umowa sprzedaży rzeczy używanej', description: 'Sprzęt, meble lub inne przedmioty między osobami prywatnymi.', category: 'sprzedaz', roles: ['Sprzedający', 'Kupujący'], defaultKinds: ['osoba', 'osoba'], relations: ['c2c'], labels: { amount: 'Cena (zł)', scope: 'Opis przedmiotu' }, scopeHint: 'np. rower szosowy, rama 56, rok 2021' },
  { id: 'sprzedaz-ratalna', name: 'Umowa sprzedaży na raty', description: 'Sprzedaż z rozłożeniem ceny na raty i zastrzeżeniem własności.', category: 'sprzedaz', roles: ['Sprzedający', 'Kupujący'], defaultKinds: ['firma', 'osoba'], relations: ['b2c', 'c2c', 'b2b'], labels: { amount: 'Cena łączna (zł)', scope: 'Opis przedmiotu i plan rat' }, scopeHint: 'np. maszyna do szycia, 6 rat po 500 zł' },
  { id: 'sprzedaz-firmowa', name: 'Umowa sprzedaży sprzętu firmowego', description: 'Sprzedaż maszyn i wyposażenia między przedsiębiorcami.', category: 'sprzedaz', roles: ['Sprzedający', 'Kupujący'], defaultKinds: ['firma', 'firma'], relations: ['b2b'], labels: { amount: 'Cena netto (zł)', scope: 'Opis sprzętu' }, scopeHint: 'np. ekspres kolbowy i młynek, rok 2022' },
  { id: 'zamiana', name: 'Umowa zamiany', description: 'Wymiana rzeczy z ewentualną dopłatą.', category: 'sprzedaz', roles: ['Strona pierwsza', 'Strona druga'], defaultKinds: ['osoba', 'osoba'], relations: ['c2c', 'b2b'], labels: { amount: 'Dopłata (zł)', scope: 'Opis wymienianych rzeczy' }, scopeHint: 'np. laptop w zamian za aparat fotograficzny z dopłatą 300 zł' },
  { id: 'przedwstepna', name: 'Umowa przedwstępna sprzedaży', description: 'Zobowiązanie do zawarcia umowy sprzedaży w przyszłości.', category: 'sprzedaz', roles: ['Przyszły sprzedający', 'Przyszły kupujący'], defaultKinds: ['osoba', 'osoba'], relations: ['c2c', 'b2c', 'b2b'], labels: { amount: 'Cena (zł)', scope: 'Przedmiot przyszłej sprzedaży' }, scopeHint: 'np. działka budowlana 900 m², zadatek 20 000 zł' },
  { id: 'komis', name: 'Umowa komisu', description: 'Sprzedaż rzeczy przez komisanta za prowizję.', category: 'sprzedaz', roles: ['Komitent', 'Komisant'], defaultKinds: ['osoba', 'firma'], relations: ['b2c', 'b2b'], labels: { amount: 'Minimalna cena sprzedaży (zł)', scope: 'Rzeczy oddane w komis' }, scopeHint: 'np. 3 obrazy olejne, minimalna cena 4 000 zł każdy' },

  // ——— Pożyczki, rozliczenia i ugody ———
  { id: 'pozyczka', name: 'Umowa pożyczki', description: 'Pożyczka pieniędzy z harmonogramem spłaty.', category: 'rozliczenia', roles: ['Pożyczkodawca', 'Pożyczkobiorca'], defaultKinds: ['osoba', 'osoba'], relations: ['c2c', 'b2b', 'b2c'], labels: { amount: 'Kwota pożyczki (zł)', scope: 'Cel i sposób spłaty', endDate: 'Termin spłaty' }, scopeHint: 'np. spłata w 10 ratach miesięcznych po 1 500 zł', popular: true },
  { id: 'pozyczka-rodzinna', name: 'Umowa pożyczki w rodzinie', description: 'Pożyczka między członkami rodziny z jasnymi zasadami zwrotu.', category: 'rozliczenia', roles: ['Pożyczkodawca', 'Pożyczkobiorca'], defaultKinds: ['osoba', 'osoba'], relations: ['c2c'], labels: { amount: 'Kwota pożyczki (zł)', scope: 'Cel i sposób spłaty', endDate: 'Termin spłaty' }, scopeHint: 'np. wkład własny na mieszkanie, spłata jednorazowa' },
  { id: 'ugoda', name: 'Ugoda pozasądowa', description: 'Zakończenie sporu przez wzajemne ustępstwa.', category: 'rozliczenia', roles: ['Wierzyciel', 'Dłużnik'], defaultKinds: ['firma', 'firma'], relations: ['b2b', 'b2c', 'c2c'], labels: { amount: 'Kwota ugody (zł)', scope: 'Opis sporu i ustępstw' }, scopeHint: 'np. spór o nieopłacone faktury z 2025 r., rozłożenie na 4 raty', popular: true },
  { id: 'porozumienie-ratalne', name: 'Porozumienie o spłacie w ratach', description: 'Rozłożenie istniejącego długu na raty.', category: 'rozliczenia', roles: ['Wierzyciel', 'Dłużnik'], defaultKinds: ['firma', 'osoba'], relations: ['b2c', 'b2b', 'c2c'], labels: { amount: 'Kwota zadłużenia (zł)', scope: 'Źródło długu i plan rat' }, scopeHint: 'np. faktura nr 12/2026, 6 rat po 2 000 zł' },
  { id: 'cesja', name: 'Umowa przelewu wierzytelności', description: 'Przeniesienie wierzytelności na inną osobę lub firmę.', category: 'rozliczenia', roles: ['Zbywca', 'Nabywca'], defaultKinds: ['firma', 'firma'], relations: ['b2b', 'c2c'], labels: { amount: 'Cena wierzytelności (zł)', scope: 'Opis wierzytelności' }, scopeHint: 'np. wierzytelność z faktury nr 45/2026 wobec XYZ sp. z o.o.' },
  { id: 'kompensata', name: 'Porozumienie o kompensacie', description: 'Wzajemne potrącenie należności między stronami.', category: 'rozliczenia', roles: ['Strona pierwsza', 'Strona druga'], defaultKinds: ['firma', 'firma'], relations: ['b2b'], labels: { amount: 'Kwota potrącenia (zł)', scope: 'Wzajemne należności' }, scopeHint: 'np. potrącenie faktur nr 7/2026 i 19/2026' },
  { id: 'podzial-majatku', name: 'Porozumienie o podziale majątku', description: 'Ustalenia małżonków lub partnerów co do podziału rzeczy i kosztów.', category: 'rozliczenia', roles: ['Strona pierwsza', 'Strona druga'], defaultKinds: ['osoba', 'osoba'], relations: ['c2c'], labels: { amount: 'Dopłata (zł)', scope: 'Składniki majątku i sposób podziału' }, scopeHint: 'np. samochód dla strony pierwszej, oszczędności po połowie' },

  // ——— Prawa autorskie, licencje i NDA ———
  { id: 'nda-wzajemna', name: 'Umowa o zachowaniu poufności (wzajemna)', description: 'NDA na czas rozmów biznesowych, gdy obie strony dzielą się informacjami.', category: 'ip', roles: ['Strona ujawniająca', 'Strona otrzymująca'], defaultKinds: ['firma', 'firma'], relations: ['b2b', 'b2c'], fields: ['scope', 'startDate', 'endDate', 'penalty', 'liability', 'extra'], labels: { scope: 'Cel ujawnienia informacji', endDate: 'Okres ochrony do' }, scopeHint: 'np. rozmowy o wspólnym wdrożeniu systemu dla sieci aptek', popular: true },
  { id: 'nda-jednostronna', name: 'Umowa o zachowaniu poufności (jednostronna)', description: 'NDA, gdy informacje przekazuje tylko jedna strona.', category: 'ip', roles: ['Strona ujawniająca', 'Strona otrzymująca'], defaultKinds: ['firma', 'osoba'], relations: ['b2b', 'b2c'], fields: ['scope', 'startDate', 'endDate', 'penalty', 'liability', 'extra'], labels: { scope: 'Cel ujawnienia informacji', endDate: 'Okres ochrony do' }, scopeHint: 'np. audyt procesów sprzedażowych przez konsultanta' },
  { id: 'licencja-niewylaczna', name: 'Umowa licencyjna niewyłączna', description: 'Zgoda na korzystanie z utworu, bez wyłączności.', category: 'ip', roles: ['Licencjodawca', 'Licencjobiorca'], defaultKinds: ['osoba', 'firma'], relations: ['b2b', 'b2c'], labels: { amount: 'Opłata licencyjna (zł)', scope: 'Utwór i pola eksploatacji' }, scopeHint: 'np. zdjęcia do wykorzystania na stronie www i w social media' },
  { id: 'licencja-wylaczna', name: 'Umowa licencyjna wyłączna', description: 'Licencja z wyłącznością na określonym terytorium lub polu.', category: 'ip', roles: ['Licencjodawca', 'Licencjobiorca'], defaultKinds: ['firma', 'firma'], relations: ['b2b'], labels: { amount: 'Opłata licencyjna (zł)', scope: 'Utwór, pola eksploatacji i terytorium' }, scopeHint: 'np. oprogramowanie do rezerwacji, wyłączność na terenie Polski' },
  { id: 'przeniesienie-praw', name: 'Umowa przeniesienia autorskich praw majątkowych', description: 'Przeniesienie praw do utworu na wskazanych polach eksploatacji.', category: 'ip', roles: ['Zbywca praw', 'Nabywca praw'], defaultKinds: ['osoba', 'firma'], relations: ['b2c', 'b2b'], labels: { amount: 'Wynagrodzenie (zł)', scope: 'Utwór i pola eksploatacji' }, scopeHint: 'np. logo i identyfikacja wizualna marki' },
  { id: 'wizerunek', name: 'Umowa o wykorzystanie wizerunku', description: 'Zgoda na wykorzystanie wizerunku w kampanii za wynagrodzeniem.', category: 'ip', roles: ['Zamawiający', 'Osoba udzielająca zgody'], defaultKinds: ['firma', 'osoba'], relations: ['b2c'], labels: { amount: 'Wynagrodzenie (zł)', scope: 'Zakres wykorzystania wizerunku' }, scopeHint: 'np. sesja do kampanii marki odzieżowej, 12 miesięcy, internet' },
  { id: 'influencer', name: 'Umowa współpracy z twórcą internetowym', description: 'Publikacje sponsorowane, oznaczanie treści i prawa do materiałów.', category: 'ip', roles: ['Marka', 'Twórca'], defaultKinds: ['firma', 'osoba'], relations: ['b2c', 'b2b'], labels: { amount: 'Wynagrodzenie (zł)', scope: 'Publikacje i kanały' }, scopeHint: 'np. 3 rolki i 6 relacji na Instagramie w marcu' },

  // ——— Wspólnicy, inwestycje i współpraca biznesowa ———
  { id: 'list-intencyjny', name: 'List intencyjny', description: 'Wstępne ustalenia przed zawarciem właściwej umowy.', category: 'wspolnicy', roles: ['Strona pierwsza', 'Strona druga'], defaultKinds: ['firma', 'firma'], relations: ['b2b'], scopeHint: 'np. intencja wspólnego otwarcia punktu gastronomicznego' },
  { id: 'umowa-wspolnikow', name: 'Umowa wspólników', description: 'Zasady współpracy, decyzji i wyjścia ze spółki.', category: 'wspolnicy', roles: ['Wspólnik A', 'Wspólnik B'], defaultKinds: ['osoba', 'osoba'], relations: ['c2c', 'b2b'], labels: { amount: 'Wkład każdego wspólnika (zł)', scope: 'Przedsięwzięcie i podział ról' }, scopeHint: 'np. sklep internetowy z kosmetykami, podział udziałów 50/50', popular: true },
  { id: 'inwestycyjna', name: 'Umowa inwestycyjna', description: 'Wejście inwestora do projektu w zamian za udziały.', category: 'wspolnicy', roles: ['Inwestor', 'Spółka / założyciel'], defaultKinds: ['osoba', 'firma'], relations: ['b2b', 'b2c'], labels: { amount: 'Kwota inwestycji (zł)', scope: 'Inwestycja i udziały' }, scopeHint: 'np. 300 000 zł za 15% udziałów, dwie transze' },
  { id: 'konsorcjum', name: 'Umowa konsorcjum', description: 'Wspólne ubieganie się o zamówienie lub realizacja projektu.', category: 'wspolnicy', roles: ['Lider konsorcjum', 'Partner'], defaultKinds: ['firma', 'firma'], relations: ['b2b'], scopeHint: 'np. wspólna oferta w przetargu na modernizację szkoły' },
  { id: 'partnerska', name: 'Umowa partnerska (polecenia klientów)', description: 'Wzajemne polecanie klientów i podział przychodów.', category: 'wspolnicy', roles: ['Partner A', 'Partner B'], defaultKinds: ['firma', 'firma'], relations: ['b2b'], labels: { amount: 'Prowizja za polecenie (zł)' }, scopeHint: 'np. biuro rachunkowe i kancelaria podatkowa polecają sobie klientów' },
  { id: 'spolka-cywilna', name: 'Umowa spółki cywilnej', description: 'Wspólne prowadzenie działalności przez wspólników.', category: 'wspolnicy', roles: ['Wspólnik A', 'Wspólnik B'], defaultKinds: ['osoba', 'osoba'], relations: ['c2c'], labels: { amount: 'Wkład każdego wspólnika (zł)', scope: 'Cel spółki' }, scopeHint: 'np. prowadzenie pracowni ceramiki' },
  { id: 'joint-venture', name: 'Umowa joint venture', description: 'Wspólne przedsięwzięcie z podziałem kosztów i zysków.', category: 'wspolnicy', roles: ['Partner A', 'Partner B'], defaultKinds: ['firma', 'firma'], relations: ['b2b'], labels: { amount: 'Wkład każdej ze stron (zł)', scope: 'Przedsięwzięcie' }, scopeHint: 'np. wspólna linia produktów pod nową marką' },
  { id: 'franczyza', name: 'Umowa franczyzy', description: 'Prowadzenie działalności pod marką i według standardów franczyzodawcy.', category: 'wspolnicy', roles: ['Franczyzodawca', 'Franczyzobiorca'], defaultKinds: ['firma', 'firma'], relations: ['b2b'], labels: { amount: 'Opłata wstępna (zł)', scope: 'Lokalizacja i zakres franczyzy' }, scopeHint: 'np. punkt z kawą na wynos w Gdańsku, opłata bieżąca 5% obrotu' },
]

export const TEMPLATES: TemplateDefinition[] = SEEDS.map((s) => ({
  ...s,
  fields: s.fields ?? BY_CATEGORY[s.category].fields,
  duties: s.duties ?? BY_CATEGORY[s.category].duties,
  status: 'przykładowy',
}))

/** Docelowa wielkość biblioteki (do komunikatów w UI). */
export const TARGET_LIBRARY_SIZE = 100

export const RELATION_LABELS: Record<PartyRelation, string> = {
  b2b: 'Firma – firma',
  b2c: 'Firma – osoba prywatna',
  c2c: 'Osoba – osoba',
}

export function getTemplate(id: string | undefined): TemplateDefinition | undefined {
  return TEMPLATES.find((t) => t.id === id)
}

export function getCategory(id: CategoryId): Category {
  return CATEGORIES.find((c) => c.id === id)!
}
