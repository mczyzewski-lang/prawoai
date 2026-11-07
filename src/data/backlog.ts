/**
 * Założenia produktu i backlog Prawo.ai – „fosy” (trwałe przewagi) w czasach AI.
 * Punkt wyjścia: prezentacja „Od iTaxi do AI – fosy w czasach AI”.
 * Edytuj tutaj – strona „Inne” (/inne) i docs/BACKLOG.md opisują to samo.
 */

export type BacklogStatus = 'gotowe' | 'w toku' | 'backlog'

export interface BacklogItem {
  title: string
  detail: string
  status: BacklogStatus
}

export interface Moat {
  /** Numer fosy w prezentacji (x/8). */
  n: number
  title: string
  /** Teza ze slajdu. */
  thesis: string
  /** Pytanie kontrolne „Sprawdź:”. */
  check: string
  /** Zasada Prawo.ai – ciemny boks „Przykład”. */
  principle: string
  /** Jak przekładamy to na Prawo.ai. */
  ours: string
  items: BacklogItem[]
}

export const MOATS: Moat[] = [
  {
    n: 4,
    title: 'Nikt nie sprawdza twojej pracy',
    thesis: 'Zaufanie zdobyte latami bycia w porządku – klient przestaje weryfikować.',
    check: 'Czego klient nigdy nie powierzyłby „domowej” wersji?',
    principle: 'Przy wysokim zaufaniu i eksperckości klient nie przegląda większości dokumentów. „Lawyer-verified” jako produkt: klient nie sprawdza, bo prawnik już sprawdził i za to odpowiada.',
    ours: 'Wzory sprawdzone przez radców prawnych i adwokatów PRAVNA.pl to fundament. Kolejny krok: weryfikacja przez prawnika jako płatna usługa dla umów i analiz użytkownika – z imiennym podpisem i odpowiedzialnością.',
    items: [
      { title: 'Wzory „Sprawdzone przez prawników PRAVNA.pl”', detail: 'Plakietka na okładkach, stronach wzorów i w bibliotece.', status: 'gotowe' },
      { title: '„Zweryfikuj u prawnika” przy umowie i analizie', detail: 'Zamówienie w 3 krokach (zakres, kontekst, podsumowanie) – gotowe w aplikacji; płatności i panel prawnika wymagają serwera.', status: 'w toku' },
      { title: 'Znak „Zweryfikowane przez prawnika” na dokumencie i w PDF', detail: 'Imię, nazwisko, numer wpisu, data – widoczne też dla drugiej strony.', status: 'backlog' },
    ],
  },
  {
    n: 5,
    title: 'Pozwolenia, licencje i certyfikaty',
    thesis: 'Software nie jest trudny. Trudne jest pozwolenie.',
    check: 'Jakich zgód potrzebuje nowy gracz, zanim klient będzie mógł zmienić dostawcę?',
    principle: 'W kancelariach, z którymi pracuje Prawo.ai, są prawnicy z uprawnieniami do reprezentacji klientów przed sądem. Nowy gracz bez licencjonowanych prawników nie przejmie od nas sprawy sądowej klienta.',
    ours: 'Prawo.ai prowadzi sprawę od umowy do sądu: gdy asystent rekomenduje prawnika albo umowa trafia w spór, sprawa przechodzi do radcy/adwokata PRAVNA z kompletem dokumentów i historią.',
    items: [
      { title: 'Rekomendacja prawnika w podsumowaniu asystenta', detail: 'Asystent ocenia, czy i dlaczego iść do prawnika.', status: 'gotowe' },
      { title: 'Przekazanie sprawy do PRAVNA', detail: 'Umówienie konsultacji z poziomu czatu/umowy; prawnik dostaje umowę, analizę, historię negocjacji.', status: 'backlog' },
      { title: 'Ścieżka sporna: wezwanie → nakaz → sąd', detail: 'Szablony pism i przejęcie reprezentacji przez prawnika z uprawnieniami.', status: 'backlog' },
    ],
  },
  {
    n: 6,
    title: 'Wszyscy już tam są',
    thesis: 'Jedna osoba zmieni narzędzie w popołudnie. Cała drużyna – prawie nigdy.',
    check: 'Ile osób musi się przenieść naraz, żeby jeden klient odszedł?',
    principle: 'Chcemy, żeby pracowała z nami cała firma klienta: sprzedaż – kontrakty, HR – umowy o pracę i aneksy, finanse – windykacja, obsługa klienta – reklamacje i sprawy klientów.',
    ours: 'Konto firmowe z zespołem i działami. Każdy dział ma swoje wzory, bazę „Adresy i dane” i obieg (akceptacja, podpis). Druga strona negocjacji to też potencjalny użytkownik (link bez rejestracji).',
    items: [
      { title: 'Wspólne negocjacje z kontrahentem przez link', detail: 'Druga strona wchodzi bez instalacji – każdy kontrahent to nowy użytkownik.', status: 'gotowe' },
      { title: 'Moje wzory i „Adresy i dane”', detail: 'Wiedza firmy (wzory, klienci, produkty) zostaje w Prawo.ai.', status: 'gotowe' },
      { title: 'Konto firmowe: zespół, role, działy', detail: 'Sprzedaż, HR, finanse, obsługa klienta; wspólne wzory i dane, uprawnienia.', status: 'backlog' },
      { title: 'Moduły działów', detail: 'HR: umowy o pracę i aneksy; finanse: windykacja; obsługa: reklamacje.', status: 'backlog' },
    ],
  },
  {
    n: 7,
    title: 'Każdy klient czyni cię mądrzejszym',
    thesis: 'UX da się skopiować ze screenshotów. Wiedzy z prawdziwych wyników – nie.',
    check: 'Co wiesz z realnego użycia, czego inni nie zasymulują, nie zescrapują i nie kupią?',
    principle: 'Wiedza z realnego użycia: monitoring zapisów, proces windykacji, wzorce klauzul w umowach. Logujemy akcję i wynik: poprawki prawników i klauzule akceptowane przez drugą stronę.',
    ours: 'Każda decyzja w Prawo.ai to sygnał: akceptacja/odrzucenie uwagi AI, propozycja zmiany przyjęta lub odrzucona przez drugą stronę, poprawki prawnika. Z tego budujemy bazę klauzul, które realnie przechodzą w negocjacjach.',
    items: [
      { title: 'Decyzje przy uwagach i propozycjach', detail: 'Akceptuj / edytuj / odrzuć oraz przyjęcie propozycji przez drugą stronę – zapisane w historii.', status: 'gotowe' },
      { title: 'Log akcji i wyników (anonimowo)', detail: 'Który zapis, jaka zmiana, czy druga strona przyjęła – po stronie serwera.', status: 'backlog' },
      { title: '„Klauzule, które przechodzą”', detail: 'Podpowiedzi typu „ta wersja zapisu jest akceptowana w 8/10 negocjacji”.', status: 'backlog' },
      { title: 'Kalendarz terminów z przypomnieniami', detail: 'Terminy odczytywane z umów przez AI, kalendarz, przypomnienia w aplikacji i przeglądarce, eksport .ics.', status: 'gotowe' },
    ],
  },
  {
    n: 8,
    title: 'Trudne do utrzymania',
    thesis: 'To, czego nienawidzisz utrzymywać, może być twoją fosą.',
    check: 'Co się posypie po 6 miesiącach, jeśli klient zvibe-koduje cię idealnie?',
    principle: 'Pieter Levels tygodniami próbował zastąpić ScrapingBee (proxy, rotacja IP, anty-boty) – poddał się i płaci $99/mies. Drip: kilka osób na pełen etat tylko do walki ze spamem. E-mail wyśle każdy – dostarczy nie każdy.',
    ours: 'Rzeczy żmudne, które muszą działać zawsze: dostarczalność e-maili i SMS do podpisu, podpis z potwierdzeniem tożsamości, aktualność wzorów po zmianach prawa, dane z KRS/CEIDG/biała lista VAT, odczyt skanów (OCR).',
    items: [
      { title: 'Wyślij do podpisu: link, e-mail, SMS', detail: 'Na razie z poczty/telefonu użytkownika.', status: 'gotowe' },
      { title: 'Własna dostarczalność e-mail i SMS', detail: 'Wysyłka z serwera (SMSAPI, domena z SPF/DKIM), statusy doręczenia i przypomnienia.', status: 'backlog' },
      { title: 'Dane firm z KRS / CEIDG / białej listy VAT', detail: 'Wpisujesz NIP – reszta danych strony uzupełnia się sama.', status: 'backlog' },
      { title: 'Aktualizacja wzorów po zmianach prawa', detail: 'Monitoring zmian i powiadomienie użytkowników, których umowy dotyczą.', status: 'backlog' },
      { title: 'OCR skanów i zdjęć umów', detail: 'Analiza umów zrobionych telefonem.', status: 'backlog' },
    ],
  },
]

/** Porównanie z rynkiem: co oferuje konkurencyjna platforma usług prawnych dla firm i jak wypada Prawo.ai. */
export interface MarketRow {
  area: string
  /** Co jest u konkurencji (bez nazwy firmy). */
  theirs: string
  /** Co jest w Prawo.ai dziś. */
  ours: string
  status: BacklogStatus
  /** Zadanie do backlogu, jeśli czegoś brakuje. */
  todo?: string
}

export const MARKET_SUMMARY =
  'Konkurencja to firma technologiczna świadcząca usługi prawne dla firm (nie kancelaria): prawnik sprawdza umowę przed podpisem, platforma pilnuje terminów i zobowiązań po podpisie. Sprzedaje stałą cenę za sprawę (od 199 zł) i abonamenty (od 299 zł/mies.). Prawo.ai to samoobsługa z AI: umowa z opisu w kilkadziesiąt sekund, analiza w około minutę, negocjacje i podpis z drugą stroną w aplikacji – z prawnikami PRAVNA.pl jako zapleczem.'

export const MARKET: MarketRow[] = [
  { area: 'Analiza umowy', theirs: 'Analiza z poprawkami weryfikowana przez prawnika; stała cena (199 zł do 3 stron, 1 500 zł do 25 stron, 2 800 zł z negocjacjami); wynik zwykle w 1 dzień roboczy.', ours: 'Analiza AI z Twojej perspektywy w ok. 1 minutę, komentarze przy konkretnych zapisach, gotowe brzmienie, akceptuj/edytuj jednym kliknięciem.', status: 'gotowe', todo: 'Płatny dodatek „Zweryfikuj u prawnika PRAVNA” ze stałą ceną i terminem.' },
  { area: 'Zakres i cena przed startem', theirs: 'Pisemny zakres, cena i termin akceptowane przed rozpoczęciem pracy; zmiana zakresu = nowa wycena.', ours: 'Zamówienie weryfikacji u prawnika: 3 pakiety ze stałą ceną, tryb ekspres, termin i cena brutto przed zamówieniem.', status: 'w toku', todo: 'Płatność online i panel prawnika (przyjęcie zlecenia, poprawki w umowie, znak weryfikacji).' },
  { area: 'Rejestr umów', theirs: 'Umowa + aneksy, decyzje, terminy i osoba odpowiedzialna w jednym zapisie; eksport danych min. 30 dni po rezygnacji.', ours: 'Moje umowy: statusy, wersje, historia, PDF; Moje wzory.', status: 'w toku', todo: 'Aneksy przy umowie, właściciel umowy, eksport wszystkich danych.' },
  { area: 'Monitoring terminów po podpisie', theirs: 'Pilnuje okien wypowiedzenia, przedłużeń i obowiązków; przypomina o decyzjach (plan od 299 zł/mies., do 25 umów).', ours: 'Kalendarz terminów: AI odczytuje płatności, realizację, gwarancję, koniec umowy i ostatni dzień na wypowiedzenie; przypomnienia w aplikacji i przeglądarce, eksport do Google/Apple/Outlook.', status: 'gotowe', todo: 'Przypomnienia e-mail/SMS wysyłane z serwera (działają, gdy aplikacja jest zamknięta).' },
  { area: 'Pamięć decyzji („mózg prawny”)', theirs: 'Wcześniejsze decyzje i zatwierdzone stanowiska wracają przy nowej umowie (np. „45 dni tylko z zaliczką”), prawnik sprawdza, czy pasują.', ours: 'Moje wzory i „Adresy i dane”; decyzje przy uwagach zapisane w historii umowy.', status: 'w toku', todo: '„Moje stanowiska”: zaakceptowane/odrzucone uwagi trafiają do profilu firmy i są uwzględniane w kolejnych analizach.' },
  { area: 'Zasady dla sprzedaży (playbook)', theirs: 'Zatwierdzone sformułowania i dopuszczalne ustępstwa, granice akceptacji, ścieżka wyjątków (4 500 zł).', ours: 'Brak.', status: 'backlog', todo: 'Playbook firmy: dopuszczalne ustępstwa i klauzule zapasowe; AI ostrzega, gdy umowa wychodzi poza zasady.' },
  { area: 'Windykacja B2B', theirs: 'Zaległa faktura: analiza umowy i korespondencji, wezwanie do zapłaty, plan spłaty, eskalacja do sądu (wyceniana osobno).', ours: 'Asystent prowadzi rozmowę o długach i rekomenduje prawnika; zaprojektowany przepływ windykacji (poniżej).', status: 'backlog', todo: 'Wdrożyć przepływ windykacji: od przeterminowanej płatności w kalendarzu do sprawy u prawnika PRAVNA.' },
  { area: 'Kondycja prawna firmy', theirs: 'Wstępna ocena i audyt: uporządkowanie umów, lista luk według priorytetu, następne zadania.', ours: 'Analiza pojedynczej umowy.', status: 'backlog', todo: 'Przegląd portfela: wgraj kilka umów → raport luk i terminów z priorytetami.' },
  { area: 'Nowe dokumenty', theirs: 'Przygotowanie przez prawnika: B2B/zlecenie/dzieło 1 500 zł, NDA 700 zł, komplet regulamin + polityka + MSA + DPA 5 500 zł; 38 usług, w tym HR (oferta zatrudnienia, regulamin pracy, ESOP).', ours: '53 wzory sprawdzone przez prawników PRAVNA.pl, umowa z opisu przez AI, kreator, Moje wzory – bez opłat.', status: 'gotowe', todo: 'Rozszerzyć bibliotekę o HR i dokumenty firmowe (regulamin, polityka prywatności, DPA); opcja „przygotuje prawnik”.' },
  { area: 'Negocjacje z drugą stroną', theirs: 'Wskazówki do negocjacji; prowadzenie negocjacji przez prawnika jako płatna usługa (+1 500 zł).', ours: 'Wspólny dokument przez link bez rejestracji, propozycje zmian, akceptacje, wersje, komentarze, gotowa wiadomość negocjacyjna.', status: 'gotowe' },
  { area: 'Podpis', theirs: 'Brak informacji o podpisie w ofercie.', ours: 'Podpis na ekranie (palec/mysz, SMS – demo), „Wyślij do podpisu” linkiem, e-mailem lub SMS-em, PDF z podpisami.', status: 'gotowe', todo: 'Podpis z weryfikacją kodem SMS z serwera; integracja z kwalifikowanym podpisem.' },
  { area: 'Bezpieczeństwo i dane', theirs: 'Dane nie służą do trenowania AI (zobowiązanie w DPA), lista podprocesorów, DPA, polityka eksportu i usuwania.', ours: 'Dane w przeglądarce; analiza przez API OpenAI.', status: 'backlog', todo: 'Strona „Bezpieczeństwo”: brak trenowania na danych, DPA, podprocesorzy, eksport i usunięcie danych.' },
  { area: 'Oznaczanie pracy AI i prawnika', theirs: 'Wyniki automatyczne są wyraźnie oznaczone; podpisaną opinią jest tylko praca zweryfikowana przez prawnika.', ours: 'Oznaczenie „Ocena wykonana przez model AI” / „analiza podstawowa”.', status: 'w toku', todo: 'Jednolity znak AI vs „Zweryfikowane przez prawnika” w całej aplikacji i w PDF.' },
  { area: 'Model cenowy', theirs: 'Za sprawę (od 199 zł) lub abonament: Start 299 zł, On Call 900 zł, Retainer 3 500 zł/mies., In-House indywidualnie.', ours: 'Brak cennika.', status: 'backlog', todo: 'Freemium: AI za darmo/limit; płatne – weryfikacja prawnika, monitoring terminów, konto firmowe.' },
  { area: 'Demo i zaufanie', theirs: 'Wideo demo 3 min, logotypy klientów, zespoły w Warszawie i Sztokholmie.', ours: 'Brak.', status: 'backlog', todo: 'Krótkie demo wideo, logotypy i opinie klientów PRAVNA.' },
]

/** Czym Prawo.ai różni się od konkurencji. */
export const DIFFERENCES: { title: string; detail: string }[] = [
  { title: 'Samoobsługa w minutach zamiast zlecenia na jutro', detail: 'Umowa z opisu w kilkadziesiąt sekund, analiza w około minutę – bez czekania na prawnika i bez płacenia od sprawy.' },
  { title: 'Prawdziwa kancelaria w zapleczu', detail: 'Konkurencja zaznacza, że nie jest kancelarią podlegającą samorządowi. Za Prawo.ai stoją radcowie prawni i adwokaci PRAVNA.pl – z uprawnieniami do reprezentacji przed sądem.' },
  { title: 'Negocjacje i podpis z drugą stroną w aplikacji', detail: 'Kontrahent wchodzi przez link, zgłasza propozycje, akceptuje wersję i podpisuje – u konkurencji negocjacje to płatna usługa prawnika.' },
  { title: 'Ocena z Twojej perspektywy przy każdym zapisie', detail: 'Komentarze przypięte do fragmentów jak w Google Docs, z priorytetem i gotowym brzmieniem do akceptacji jednym kliknięciem.' },
  { title: 'Asystent, który edytuje umowę', detail: 'Zmiany wprowadzane rozmową, z odwołaniami do paragrafów i cofaniem; dane osób i produktów wstawiane przez @.' },
  { title: 'Także dla osób prywatnych', detail: 'Konkurencja celuje w firmy (B2B). Prawo.ai obsługuje też sprawy konsumenckie, rodzinne i długi – z asystentem i przejściem do prawnika.' },
  { title: 'Czego nam brakuje', detail: 'Stałej opieki po podpisie (rejestr, terminy, przypomnienia), pamięci decyzji firmy, płatnej weryfikacji prawnika ze stałą ceną, windykacji, playbooka sprzedaży i strony o bezpieczeństwie danych – to trafia do backlogu powyżej.' },
]

/** Proponowany przepływ windykacji B2B w Prawo.ai (do akceptacji przed wdrożeniem). */
export interface FlowStep {
  title: string
  when: string
  what: string
  ai: string
  paid?: string
}

export const COLLECTION_FLOW: FlowStep[] = [
  {
    title: 'Start: zaległa płatność',
    when: 'Termin płatności w kalendarzu minął albo użytkownik dodaje należność ręcznie',
    what: 'W „Terminach” przy przeterminowanej płatności pojawia się „Nie zapłacono? Rozpocznij windykację”. Można też wgrać fakturę lub wskazać dłużnika przez @ z „Adresy i dane”.',
    ai: 'Odczyt faktury (numer, kwota, termin), powiązanie z umową i jej zapisami o płatności.',
  },
  {
    title: 'Ocena sprawy',
    when: 'Od razu po dodaniu należności',
    what: 'Podsumowanie: kwota, dni opóźnienia, odsetki za opóźnienie i rekompensata za koszty odzyskania (B2B) wyliczone automatycznie, ostrzeżenie o zbliżającym się przedawnieniu, czy dług jest sporny.',
    ai: 'Rekomendacja ścieżki: przypomnienie, wezwanie albo od razu prawnik (np. przy dużej kwocie lub sporze).',
  },
  {
    title: 'Przypomnienie polubowne',
    when: '1–7 dni po terminie',
    what: 'Uprzejma wiadomość e-mail lub SMS z kwotą i numerem konta – wysyłana jednym kliknięciem, z linkiem do sprawy dla dłużnika.',
    ai: 'Ton dopasowany do relacji („stały klient” / „pierwsze zlecenie”).',
  },
  {
    title: 'Wezwanie do zapłaty',
    when: 'Brak wpłaty po przypomnieniu (np. 14 dni po terminie)',
    what: 'Przedsądowe wezwanie z odsetkami, rekompensatą i 7-dniowym terminem – jako PDF z podpisem, wysyłka e-mailem; w kalendarzu termin z przypomnieniem.',
    ai: 'Wezwanie przygotowane z umowy i faktur, z właściwymi danymi stron.',
    paid: 'Wezwanie na papierze firmowym kancelarii PRAVNA.pl (wyższa skuteczność) – stała cena.',
  },
  {
    title: 'Ugoda lub plan spłaty',
    when: 'Dłużnik reaguje',
    what: 'Dłużnik dostaje link (jak druga strona umowy): widzi należność, proponuje raty, podpisuje na ekranie ugodę lub uznanie długu. Raty trafiają do kalendarza z przypomnieniami.',
    ai: 'Propozycja harmonogramu rat i treść porozumienia.',
  },
  {
    title: 'Monitoring wpłat',
    when: 'Do pełnej spłaty',
    what: 'Status sprawy: nowa → przypomnienie → wezwanie → ugoda → spłacona / u prawnika. Zaległa rata = automatyczne przypomnienie.',
    ai: 'Podsumowanie stanu sprawy i kolejnego kroku.',
  },
  {
    title: 'Eskalacja do prawnika',
    when: 'Brak zapłaty lub spór',
    what: 'Sprawa przechodzi do radcy prawnego / adwokata PRAVNA.pl z kompletem: umowa, faktury, korespondencja, wezwanie, historia. Pozew (w tym elektroniczne postępowanie upominawcze), reprezentacja, egzekucja.',
    ai: 'Przygotowanie akt i projektu pozwu dla prawnika.',
    paid: 'Stała cena za etap (pozew, reprezentacja) + opcjonalnie wynagrodzenie od sukcesu.',
  },
]
