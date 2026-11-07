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
      { title: '„Zweryfikuj u prawnika” przy umowie i analizie', detail: 'Jedno kliknięcie: umowa + uwagi AI trafiają do prawnika PRAVNA, wraca wersja z poprawkami i podpisem prawnika.', status: 'backlog' },
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
      { title: 'Monitoring zapisów i terminów', detail: 'Przypomnienia o terminach z umów (płatności, wypowiedzenia, gwarancje).', status: 'backlog' },
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
