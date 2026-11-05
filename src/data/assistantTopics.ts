import type { AssistantSummary } from '../types'

/**
 * Scenariusze rozmowy asystenta (bez modelu językowego).
 * Każdy temat ma pytania doprecyzowujące i funkcję budującą podsumowanie.
 * Treści są ogólne, nie powołują się na konkretne przepisy i zawsze kończą się
 * oceną, czy warto skonsultować sprawę z prawnikiem.
 * Po podłączeniu modelu AI ten plik może posłużyć jako zestaw scenariuszy testowych.
 */

export interface TopicQuestion {
  id: string
  text: string
  options?: string[]
}

export interface Topic {
  id: string
  title: string
  description: string
  keywords: RegExp
  intro: string
  questions: TopicQuestion[]
  summarize: (a: Record<string, string>, freeText: string) => AssistantSummary
}

const yes = (v?: string) => !!v && /^(tak|raczej tak)/i.test(v)

export const TOPICS: Topic[] = [
  {
    id: 'rozwod',
    title: 'Rozwód i ustalenia między małżonkami',
    description: 'Podział majątku, opieka nad dziećmi, alimenty, porozumienie.',
    keywords: /rozw[oó]d|małż|żon[aey]|męż|separac|alimen|opiek[ai] nad dzie|podział majątku/i,
    intro: 'Rozumiem, że chodzi o sprawy między małżonkami. To często trudny czas – postaram się pomóc uporządkować najważniejsze kwestie. Zadam kilka pytań.',
    questions: [
      { id: 'agreement', text: 'Czy Ty i małżonek(-ka) jesteście zgodni co do zakończenia małżeństwa?', options: ['Tak, oboje tego chcemy', 'Raczej tak, ale są sporne kwestie', 'Nie, druga strona się nie zgadza', 'Nie wiem'] },
      { id: 'children', text: 'Czy macie wspólne małoletnie dzieci?', options: ['Tak', 'Nie'] },
      { id: 'property', text: 'Czy macie wspólny majątek do podziału (np. mieszkanie, kredyt, samochód)?', options: ['Tak, w tym nieruchomość lub kredyt', 'Tak, ale niewielki', 'Nie'] },
      { id: 'goal', text: 'Co jest teraz dla Ciebie najważniejsze?', options: ['Spisanie porozumienia', 'Ustalenie opieki i kontaktów z dziećmi', 'Podział majątku', 'Zrozumienie, jak wygląda procedura'] },
    ],
    summarize: (a) => {
      const children = yes(a.children)
      const conflict = /nie/i.test(a.agreement ?? '') || /sporne/i.test(a.agreement ?? '')
      return {
        situation: `Rozważasz zakończenie małżeństwa${children ? ' i macie wspólne małoletnie dzieci' : ''}. ${conflict ? 'Między Wami są sporne kwestie, co zwykle wydłuża postępowanie.' : 'Wygląda na to, że możecie dojść do porozumienia, co zwykle upraszcza sprawę.'} ${/nieruchomo|kredyt/i.test(a.property ?? '') ? 'Do uporządkowania jest też majątek obejmujący nieruchomość lub kredyt.' : ''}`.trim(),
        steps: [
          conflict ? 'Spróbuj ustalić, które kwestie są sporne, a które uzgodnione – rozważ mediację, która pomaga wypracować porozumienie.' : 'Spiszcie wspólne ustalenia na piśmie – to ułatwi dalsze kroki.',
          children ? 'Przygotujcie propozycję porozumienia o sposobie wykonywania władzy rodzicielskiej i kontaktach z dziećmi oraz o kosztach ich utrzymania.' : 'Ustalcie sposób rozliczenia wspólnych kosztów i zobowiązań.',
          'Zbierz informacje o wspólnym majątku i zobowiązaniach (np. kredytach) – ich wartość i daty nabycia.',
          'Sprawdź, jaki sąd będzie właściwy i jakie opłaty wiążą się z pozwem – najlepiej z pomocą prawnika lub na stronie sądu.',
        ],
        documents: ['Odpis skrócony aktu małżeństwa', ...(children ? ['Odpisy skrócone aktów urodzenia dzieci', 'Zestawienie kosztów utrzymania dzieci'] : []), 'Informacje o dochodach', 'Dokumenty dotyczące majątku i kredytów'],
        lawyer: { recommended: true, reason: children || conflict ? 'Sprawy rodzinne z udziałem dzieci lub sporami warto prowadzić z adwokatem lub radcą prawnym – pomoże on przygotować pozew i porozumienie.' : 'Nawet przy zgodzie stron warto, by prawnik sprawdził treść porozumienia i pozwu przed złożeniem.' },
      }
    },
  },
  {
    id: 'umowy',
    title: 'Umowy i negocjacje',
    description: 'Zawarcie, zmiana lub zakończenie umowy, spór z kontrahentem.',
    keywords: /umow|kontrahent|negocj|aneks|wypowiedz|zleceni|dzieło|kontrakt/i,
    intro: 'Pomogę uporządkować sprawę dotyczącą umowy. Kilka pytań, żebym lepiej zrozumiał sytuację.',
    questions: [
      { id: 'stage', text: 'Na jakim etapie jest umowa?', options: ['Dopiero ją negocjujemy', 'Jest podpisana i trwa', 'Chcę ją zakończyć', 'Jest spór o jej wykonanie'] },
      { id: 'who', text: 'Kim są strony?', options: ['Dwie firmy', 'Ja (osoba prywatna) i firma', 'Dwie osoby prywatne'] },
      { id: 'written', text: 'Czy macie umowę na piśmie lub w e-mailach?', options: ['Tak, pisemną', 'Tylko ustalenia w e-mailach / wiadomościach', 'Nie, ustnie'] },
      { id: 'value', text: 'Jaka jest mniej więcej wartość umowy?', options: ['Do 10 000 zł', '10 000 – 100 000 zł', 'Powyżej 100 000 zł'] },
    ],
    summarize: (a) => {
      const dispute = /spór|zakończyć/i.test(a.stage ?? '')
      const big = /powyżej/i.test(a.value ?? '')
      return {
        situation: `Sprawa dotyczy umowy (${(a.who ?? '').toLowerCase() || 'strony nieokreślone'}), która ${(a.stage ?? '').toLowerCase().replace('chcę', 'chcesz')}. ${/ustnie/i.test(a.written ?? '') ? 'Brak pisemnych ustaleń utrudnia udowodnienie warunków – warto je jak najszybciej potwierdzić na piśmie.' : 'Masz ustalenia w formie pisemnej lub elektronicznej, co ułatwia ocenę sytuacji.'}`,
        steps: dispute
          ? ['Sprawdź w umowie zapisy o wypowiedzeniu, odpowiedzialności i karach umownych.', 'Zbierz korespondencję i dowody wykonania (lub niewykonania) umowy.', 'Spróbuj rozwiązać sprawę polubownie – wyślij rzeczowe pismo z opisem problemu i propozycją rozwiązania.', 'Jeśli to nie pomoże, rozważ wezwanie do wykonania umowy lub zapłaty z wyznaczonym terminem.']
          : ['Spisz najważniejsze warunki: zakres, cenę, terminy, odpowiedzialność i zasady zakończenia.', 'Skorzystaj z kreatora umów lub przeanalizuj projekt otrzymany od drugiej strony.', 'Proponuj zmiany jako konkretne brzmienie zapisu z krótkim uzasadnieniem.'],
        documents: ['Umowa lub projekt umowy', 'Korespondencja z drugą stroną', 'Faktury, protokoły odbioru, potwierdzenia płatności'],
        lawyer: { recommended: big || dispute, reason: big ? 'Przy wysokiej wartości umowy koszt konsultacji jest zwykle niewielki w porównaniu z ryzykiem.' : dispute ? 'W sporze prawnik pomoże ocenić szanse i przygotować pismo do drugiej strony.' : 'Przy prostych umowach często wystarczy staranne sprawdzenie zapisów – możesz skorzystać z analizy umowy w aplikacji.' },
      }
    },
  },
  {
    id: 'konsument',
    title: 'Problemy konsumenckie',
    description: 'Reklamacja, zwrot towaru, wadliwa usługa, sklep internetowy.',
    keywords: /reklamac|zwrot|sklep|wadliw|zepsu|gwarancj|konsument|kupił|zamówi/i,
    intro: 'Pomogę uporządkować sprawę konsumencką. Odpowiedz proszę na kilka pytań.',
    questions: [
      { id: 'what', text: 'Czego dotyczy problem?', options: ['Wadliwy towar', 'Chcę zwrócić towar kupiony online', 'Usługa wykonana źle lub wcale', 'Niechciana umowa lub opłaty'] },
      { id: 'when', text: 'Kiedy dokonano zakupu lub zawarto umowę?', options: ['W ciągu ostatnich 14 dni', 'Od 2 tygodni do roku temu', 'Ponad rok temu'] },
      { id: 'contact', text: 'Czy kontaktowałeś(-aś) się już ze sprzedawcą?', options: ['Nie', 'Tak, bez odpowiedzi', 'Tak, odmówił'] },
    ],
    summarize: (a) => ({
      situation: `Problem dotyczy: ${(a.what ?? 'zakupu').toLowerCase()}. Zakup miał miejsce ${(a.when ?? '').toLowerCase() || 'w nieokreślonym czasie'}. ${/odmówił/i.test(a.contact ?? '') ? 'Sprzedawca odmówił – warto skorzystać z pomocy bezpłatnych instytucji konsumenckich.' : ''}`.trim(),
      steps: [
        'Sprawdź regulamin sklepu i warunki umowy, zwłaszcza terminy na zwrot i zgłoszenie reklamacji.',
        'Złóż reklamację lub oświadczenie na piśmie (e-mail też się liczy) – opisz problem, datę zakupu i czego żądasz.',
        'Zachowaj kopię zgłoszenia i potwierdzenie wysłania.',
        'Jeśli sprzedawca nie odpowie lub odmówi, skontaktuj się z miejskim lub powiatowym rzecznikiem konsumentów – pomoc jest bezpłatna.',
      ],
      documents: ['Paragon, faktura lub potwierdzenie zamówienia', 'Zdjęcia wady lub opis problemu', 'Korespondencja ze sprzedawcą'],
      lawyer: { recommended: false, reason: 'W typowych sprawach konsumenckich zwykle wystarczy pomoc rzecznika konsumentów. Prawnik może być potrzebny przy wysokich kwotach lub sprawie sądowej.' },
    }),
  },
  {
    id: 'firma',
    title: 'Sprawy firmowe',
    description: 'Założenie działalności, wspólnicy, współpraca z klientami.',
    keywords: /firm|działalnoś|spółk|wspólnik|jdg|przedsiębior|zatrudni|pracownik|b2b/i,
    intro: 'Zajmijmy się sprawą firmową. Kilka pytań pomoże mi lepiej zrozumieć sytuację.',
    questions: [
      { id: 'form', text: 'Jaką formę ma Twoja działalność?', options: ['Jednoosobowa działalność', 'Spółka (np. z o.o.)', 'Dopiero zakładam firmę'] },
      { id: 'issue', text: 'Czego dotyczy sprawa?', options: ['Współpraca ze wspólnikiem', 'Umowy z klientami lub dostawcami', 'Zatrudnianie osób', 'Wybór formy działalności'] },
      { id: 'urgent', text: 'Czy sprawa jest pilna (np. termin w najbliższych dniach)?', options: ['Tak', 'Nie'] },
    ],
    summarize: (a) => ({
      situation: `Prowadzisz lub planujesz działalność (${(a.form ?? '').toLowerCase()}), a sprawa dotyczy: ${(a.issue ?? '').toLowerCase()}. ${yes(a.urgent) ? 'Sprawa jest pilna, dlatego w pierwszej kolejności zabezpiecz terminy.' : ''}`.trim(),
      steps: [
        /wspólnik/i.test(a.issue ?? '') ? 'Spiszcie zasady współpracy wspólników: podział ról, decyzji, zysków i zasady wyjścia z biznesu.' : 'Spisz najważniejsze ustalenia i ryzyka związane ze sprawą.',
        'Sprawdź dokumenty założycielskie i obowiązujące umowy pod kątem zapisów, które dotyczą sprawy.',
        'Skonsultuj kwestie podatkowe i księgowe z księgowym.',
        'Korzystaj z pisemnych umów – w bibliotece wzorów znajdziesz m.in. umowę wspólników i umowę o współpracy.',
      ],
      documents: ['Wpis do CEIDG lub KRS', 'Umowa spółki (jeśli dotyczy)', 'Obowiązujące umowy z kontrahentami'],
      lawyer: { recommended: /spółka|wspólnik/i.test(`${a.form} ${a.issue}`), reason: 'Przy spółkach i relacjach wspólników warto skonsultować dokumenty z radcą prawnym, bo błędy są trudne do odwrócenia.' },
    }),
  },
  {
    id: 'znaki',
    title: 'Znaki towarowe',
    description: 'Ochrona nazwy i logo, zgłoszenie znaku, naruszenia.',
    keywords: /znak towar|logo|nazw[ay] (firmy|marki)|mark[ai]|zastrzec|rejestracj[ai] znaku|podróbk/i,
    intro: 'Porozmawiajmy o ochronie marki. Kilka pytań na początek.',
    questions: [
      { id: 'situation', text: 'Jaka jest Twoja sytuacja?', options: ['Chcę chronić swoją markę', 'Ktoś używa podobnej nazwy', 'Dostałem(-am) zarzut naruszenia'] },
      { id: 'scope', text: 'Gdzie działasz lub planujesz działać?', options: ['Tylko w Polsce', 'W kilku krajach UE', 'Poza UE'] },
      { id: 'used', text: 'Czy już używasz tej nazwy lub logo?', options: ['Tak, od ponad roku', 'Tak, od niedawna', 'Jeszcze nie'] },
    ],
    summarize: (a) => ({
      situation: `Sprawa dotyczy znaku towarowego: ${(a.situation ?? '').toLowerCase()}. Zakres działalności: ${(a.scope ?? '').toLowerCase()}.`,
      steps: [
        'Sprawdź w publicznych bazach znaków towarowych, czy nie ma zarejestrowanych podobnych oznaczeń dla podobnych towarów lub usług.',
        'Określ, dla jakich towarów i usług znak ma być chroniony – od tego zależy zakres ochrony i koszty.',
        /zarzut|używa/i.test(a.situation ?? '') ? 'Zbierz dowody, od kiedy i w jaki sposób używasz oznaczenia, oraz nie podejmuj pochopnych deklaracji w korespondencji.' : 'Rozważ zgłoszenie znaku w urzędzie właściwym dla obszaru, na którym działasz.',
      ],
      documents: ['Wizerunek znaku (logo) i jego nazwa', 'Lista towarów i usług', 'Dowody używania znaku (faktury, strony www, materiały)'],
      lawyer: { recommended: true, reason: 'Zgłoszeniami i sporami o znaki towarowe zajmują się zwykle rzecznicy patentowi lub prawnicy specjalizujący się w tej dziedzinie.' },
    }),
  },
  {
    id: 'dlugi',
    title: 'Długi i wezwania do zapłaty',
    description: 'Ktoś Ci nie płaci albo otrzymałeś(-aś) wezwanie.',
    keywords: /dług|wezwani|zapłat|windyk|komornik|nie płaci|zaległ|faktur[ay] niezapłac|nakaz zapłaty/i,
    intro: 'Pomogę uporządkować sprawę dotyczącą płatności. Najpierw ustalmy kilka faktów.',
    questions: [
      { id: 'side', text: 'Po której stronie jesteś?', options: ['Ktoś jest mi winien pieniądze', 'Otrzymałem(-am) wezwanie do zapłaty', 'Dostałem(-am) pismo z sądu lub od komornika'] },
      { id: 'amount', text: 'Jaka jest kwota?', options: ['Do 5 000 zł', '5 000 – 50 000 zł', 'Powyżej 50 000 zł'] },
      { id: 'age', text: 'Od kiedy płatność jest zaległa?', options: ['Kilka tygodni', 'Kilka miesięcy', 'Ponad 2 lata', 'Nie wiem'] },
    ],
    summarize: (a) => {
      const court = /sądu|komornik/i.test(a.side ?? '')
      const creditor = /winien/i.test(a.side ?? '')
      return {
        situation: creditor
          ? `Ktoś zalega Ci z płatnością (${(a.amount ?? '').toLowerCase()}) od: ${(a.age ?? '').toLowerCase()}.`
          : court
            ? 'Otrzymałeś(-aś) pismo z sądu lub od komornika. W takich pismach zwykle są krótkie terminy na reakcję – sprawdź datę doręczenia.'
            : `Otrzymałeś(-aś) wezwanie do zapłaty (${(a.amount ?? '').toLowerCase()}).`,
        steps: creditor
          ? ['Zbierz dokumenty potwierdzające dług: umowę, faktury, korespondencję.', 'Wyślij dłużnikowi wezwanie do zapłaty z konkretnym terminem i numerem rachunku.', 'Rozważ propozycję spłaty w ratach – w bibliotece wzorów znajdziesz „Porozumienie o spłacie w ratach”.', 'Jeśli dłużnik nie zapłaci, sprawdź z prawnikiem możliwość skierowania sprawy do sądu i to, czy roszczenie nie jest przedawnione.']
          : ['Nie ignoruj pisma i sprawdź, czy dług rzeczywiście istnieje i w jakiej wysokości.', court ? 'Ustal termin na odpowiedź lub sprzeciw – liczy się od dnia doręczenia pisma.' : 'Poproś nadawcę o dokumenty potwierdzające dług, jeśli ich nie przedstawił.', /ponad 2 lata/i.test(a.age ?? '') ? 'Sprawdź z prawnikiem, czy roszczenie nie jest przedawnione.' : 'Jeśli dług istnieje, rozważ propozycję ugody lub rozłożenia na raty.'],
        documents: ['Wezwanie lub pismo, które otrzymałeś(-aś), z kopertą (data doręczenia)', 'Umowa i faktury', 'Potwierdzenia dokonanych wpłat'],
        lawyer: { recommended: court || /powyżej/i.test(a.amount ?? ''), reason: court ? 'Pisma sądowe i komornicze mają krótkie terminy – skontaktuj się z prawnikiem jak najszybciej.' : 'Przy wyższych kwotach warto, by prawnik ocenił dokumenty i przedawnienie.' },
      }
    },
  },
  {
    id: 'inne',
    title: 'Inny problem prawny',
    description: 'Opisz sytuację własnymi słowami.',
    keywords: /$^/,
    intro: 'Opowiedz o sytuacji – zadam kilka pytań, żeby lepiej ją zrozumieć.',
    questions: [
      { id: 'area', text: 'Czy sprawa dotyczy Ciebie prywatnie, czy firmy?', options: ['Mnie prywatnie', 'Mojej firmy', 'Kogoś bliskiego'] },
      { id: 'deadline', text: 'Czy w sprawie biegną jakieś terminy (np. z pisma, które otrzymałeś(-aś))?', options: ['Tak', 'Nie', 'Nie wiem'] },
      { id: 'details', text: 'Opisz w kilku zdaniach, co się wydarzyło i czego oczekujesz.' },
    ],
    summarize: (a, free) => ({
      situation: `Sprawa dotyczy: ${(a.area ?? '').toLowerCase()}. ${a.details || free ? `Z Twojego opisu: „${(a.details || free).slice(0, 220)}${(a.details || free).length > 220 ? '…' : ''}”.` : ''} ${yes(a.deadline) ? 'W sprawie biegną terminy – zacznij od ich ustalenia.' : ''}`.trim(),
      steps: ['Spisz chronologię zdarzeń z datami.', 'Zbierz wszystkie dokumenty i korespondencję w jednym miejscu.', yes(a.deadline) || /nie wiem/i.test(a.deadline ?? '') ? 'Ustal, do kiedy trzeba odpowiedzieć lub podjąć działanie.' : 'Określ, jaki wynik byłby dla Ciebie satysfakcjonujący.', 'Skonsultuj sprawę z prawnikiem z odpowiedniej specjalizacji.'],
      documents: ['Pisma i umowy związane ze sprawą', 'Korespondencja', 'Notatki z ważnych rozmów'],
      lawyer: { recommended: true, reason: 'Bez dokładniejszych informacji trudno ocenić sprawę – rozmowa z prawnikiem pozwoli ustalić Twoją sytuację i możliwe rozwiązania.' },
    }),
  },
]

export function detectTopic(text: string): Topic {
  return TOPICS.find((t) => t.keywords.test(text)) ?? TOPICS[TOPICS.length - 1]
}

export function getTopic(id: string): Topic {
  return TOPICS.find((t) => t.id === id) ?? TOPICS[TOPICS.length - 1]
}
