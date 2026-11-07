# Założenia produktu i backlog – „fosy” w czasach AI

Źródło: prezentacja „Od iTaxi do AI – fosy w czasach AI” (fosy 4–8); zasady Prawo.ai z ciemnych boksów „Przykład”.
W aplikacji: zakładka **Inne** (`/inne`). Dane do edycji: `src/data/backlog.ts`.

| Fosa | Zasada Prawo.ai | Jak to realizujemy | Backlog |
|---|---|---|---|
| 4/8 Nikt nie sprawdza twojej pracy | „Lawyer-verified” jako produkt: klient nie sprawdza, bo prawnik już sprawdził i za to odpowiada. | Wzory sprawdzone przez prawników PRAVNA.pl (gotowe); weryfikacja umów i analiz użytkownika przez prawnika. | „Zweryfikuj u prawnika” przy umowie/analizie; znak weryfikacji z imieniem prawnika w dokumencie i PDF. |
| 5/8 Pozwolenia, licencje i certyfikaty | Prawnicy z uprawnieniami do reprezentacji przed sądem – nowy gracz nie przejmie od nas sprawy sądowej. | Sprawa od umowy do sądu: przekazanie do radcy/adwokata PRAVNA z kompletem dokumentów. | Umówienie konsultacji z czatu/umowy; ścieżka sporna (wezwanie → nakaz → sąd). |
| 6/8 Wszyscy już tam są | Cała firma klienta: sprzedaż – kontrakty, HR – umowy o pracę i aneksy, finanse – windykacja, obsługa – reklamacje. | Konto firmowe z działami; wspólne wzory i „Adresy i dane”; kontrahent wchodzi przez link. | Zespół, role, działy; moduły HR / windykacja / reklamacje. |
| 7/8 Każdy klient czyni cię mądrzejszym | Logujemy akcję i wynik: poprawki prawników i klauzule akceptowane przez drugą stronę; monitoring zapisów, windykacja. | Każda decyzja (akceptacja uwagi AI, przyjęcie propozycji przez drugą stronę, poprawka prawnika) to sygnał. | Anonimowy log akcji i wyników na serwerze; „klauzule, które przechodzą”; monitoring terminów z umów. |
| 8/8 Trudne do utrzymania | „E-mail wyśle każdy – dostarczy nie każdy” (Drip); ScrapingBee zamiast własnych proxy. | Żmudne rzeczy, które muszą działać: dostarczalność, podpis, aktualność wzorów, dane rejestrowe, OCR. | Wysyłka e-mail/SMS z serwera ze statusami; KRS/CEIDG/biała lista VAT; aktualizacje wzorów po zmianach prawa; OCR. |

## Rynek: konkurencja a Prawo.ai

Konkurencja to firma technologiczna świadcząca usługi prawne dla firm (nie kancelaria): prawnik sprawdza umowę przed podpisem, platforma pilnuje terminów i zobowiązań po podpisie. Sprzedaje stałą cenę za sprawę (od 199 zł) i abonamenty (od 299 zł/mies.). Prawo.ai to samoobsługa z AI: umowa z opisu w kilkadziesiąt sekund, analiza w około minutę, negocjacje i podpis z drugą stroną w aplikacji – z prawnikami PRAVNA.pl jako zapleczem.

| Obszar | Konkurencja | Prawo.ai | Status | Backlog |
|---|---|---|---|---|
| Analiza umowy | Analiza z poprawkami weryfikowana przez prawnika; stała cena (199 zł do 3 stron, 1 500 zł do 25 stron, 2 800 zł z negocjacjami); wynik zwykle w 1 dzień roboczy. | Analiza AI z Twojej perspektywy w ok. 1 minutę, komentarze przy konkretnych zapisach, gotowe brzmienie, akceptuj/edytuj jednym kliknięciem. | gotowe | Płatny dodatek „Zweryfikuj u prawnika PRAVNA” ze stałą ceną i terminem. |
| Zakres i cena przed startem | Pisemny zakres, cena i termin akceptowane przed rozpoczęciem pracy; zmiana zakresu = nowa wycena. | Funkcje AI bez wyceny; brak zleceń dla prawnika. | backlog | Zamówienie usługi prawnika: zakres, cena i termin do akceptacji w aplikacji, płatność online. |
| Rejestr umów | Umowa + aneksy, decyzje, terminy i osoba odpowiedzialna w jednym zapisie; eksport danych min. 30 dni po rezygnacji. | Moje umowy: statusy, wersje, historia, PDF; Moje wzory. | w toku | Aneksy przy umowie, właściciel umowy, eksport wszystkich danych. |
| Monitoring terminów po podpisie | Pilnuje okien wypowiedzenia, przedłużeń i obowiązków; przypomina o decyzjach (plan od 299 zł/mies., do 25 umów). | Analiza AI wyciąga terminy i płatności, ale nie przypomina o nich. | backlog | Kalendarz terminów z umów i przypomnienia e-mail/SMS (np. „za 30 dni zamyka się okno wypowiedzenia”). |
| Pamięć decyzji („mózg prawny”) | Wcześniejsze decyzje i zatwierdzone stanowiska wracają przy nowej umowie (np. „45 dni tylko z zaliczką”), prawnik sprawdza, czy pasują. | Moje wzory i „Adresy i dane”; decyzje przy uwagach zapisane w historii umowy. | w toku | „Moje stanowiska”: zaakceptowane/odrzucone uwagi trafiają do profilu firmy i są uwzględniane w kolejnych analizach. |
| Zasady dla sprzedaży (playbook) | Zatwierdzone sformułowania i dopuszczalne ustępstwa, granice akceptacji, ścieżka wyjątków (4 500 zł). | Brak. | backlog | Playbook firmy: dopuszczalne ustępstwa i klauzule zapasowe; AI ostrzega, gdy umowa wychodzi poza zasady. |
| Windykacja B2B | Zaległa faktura: analiza umowy i korespondencji, wezwanie do zapłaty, plan spłaty, eskalacja do sądu (wyceniana osobno). | Asystent prowadzi rozmowę o długach i rekomenduje prawnika. | backlog | Moduł windykacji: umowa + faktura → wezwanie do zapłaty z AI, przypomnienia, przekazanie do PRAVNA. |
| Kondycja prawna firmy | Wstępna ocena i audyt: uporządkowanie umów, lista luk według priorytetu, następne zadania. | Analiza pojedynczej umowy. | backlog | Przegląd portfela: wgraj kilka umów → raport luk i terminów z priorytetami. |
| Nowe dokumenty | Przygotowanie przez prawnika: B2B/zlecenie/dzieło 1 500 zł, NDA 700 zł, komplet regulamin + polityka + MSA + DPA 5 500 zł; 38 usług, w tym HR (oferta zatrudnienia, regulamin pracy, ESOP). | 53 wzory sprawdzone przez prawników PRAVNA.pl, umowa z opisu przez AI, kreator, Moje wzory – bez opłat. | gotowe | Rozszerzyć bibliotekę o HR i dokumenty firmowe (regulamin, polityka prywatności, DPA); opcja „przygotuje prawnik”. |
| Negocjacje z drugą stroną | Wskazówki do negocjacji; prowadzenie negocjacji przez prawnika jako płatna usługa (+1 500 zł). | Wspólny dokument przez link bez rejestracji, propozycje zmian, akceptacje, wersje, komentarze, gotowa wiadomość negocjacyjna. | gotowe |  |
| Podpis | Brak informacji o podpisie w ofercie. | Podpis na ekranie (palec/mysz, SMS – demo), „Wyślij do podpisu” linkiem, e-mailem lub SMS-em, PDF z podpisami. | gotowe | Podpis z weryfikacją kodem SMS z serwera; integracja z kwalifikowanym podpisem. |
| Bezpieczeństwo i dane | Dane nie służą do trenowania AI (zobowiązanie w DPA), lista podprocesorów, DPA, polityka eksportu i usuwania. | Dane w przeglądarce; analiza przez API OpenAI. | backlog | Strona „Bezpieczeństwo”: brak trenowania na danych, DPA, podprocesorzy, eksport i usunięcie danych. |
| Oznaczanie pracy AI i prawnika | Wyniki automatyczne są wyraźnie oznaczone; podpisaną opinią jest tylko praca zweryfikowana przez prawnika. | Oznaczenie „Ocena wykonana przez model AI” / „analiza podstawowa”. | w toku | Jednolity znak AI vs „Zweryfikowane przez prawnika” w całej aplikacji i w PDF. |
| Model cenowy | Za sprawę (od 199 zł) lub abonament: Start 299 zł, On Call 900 zł, Retainer 3 500 zł/mies., In-House indywidualnie. | Brak cennika. | backlog | Freemium: AI za darmo/limit; płatne – weryfikacja prawnika, monitoring terminów, konto firmowe. |
| Demo i zaufanie | Wideo demo 3 min, logotypy klientów, zespoły w Warszawie i Sztokholmie. | Brak. | backlog | Krótkie demo wideo, logotypy i opinie klientów PRAVNA. |

### Czym różni się Prawo.ai

- **Samoobsługa w minutach zamiast zlecenia na jutro** – Umowa z opisu w kilkadziesiąt sekund, analiza w około minutę – bez czekania na prawnika i bez płacenia od sprawy.
- **Prawdziwa kancelaria w zapleczu** – Konkurencja zaznacza, że nie jest kancelarią podlegającą samorządowi. Za Prawo.ai stoją radcowie prawni i adwokaci PRAVNA.pl – z uprawnieniami do reprezentacji przed sądem.
- **Negocjacje i podpis z drugą stroną w aplikacji** – Kontrahent wchodzi przez link, zgłasza propozycje, akceptuje wersję i podpisuje – u konkurencji negocjacje to płatna usługa prawnika.
- **Ocena z Twojej perspektywy przy każdym zapisie** – Komentarze przypięte do fragmentów jak w Google Docs, z priorytetem i gotowym brzmieniem do akceptacji jednym kliknięciem.
- **Asystent, który edytuje umowę** – Zmiany wprowadzane rozmową, z odwołaniami do paragrafów i cofaniem; dane osób i produktów wstawiane przez @.
- **Także dla osób prywatnych** – Konkurencja celuje w firmy (B2B). Prawo.ai obsługuje też sprawy konsumenckie, rodzinne i długi – z asystentem i przejściem do prawnika.
- **Czego nam brakuje** – Stałej opieki po podpisie (rejestr, terminy, przypomnienia), pamięci decyzji firmy, płatnej weryfikacji prawnika ze stałą ceną, windykacji, playbooka sprzedaży i strony o bezpieczeństwie danych – to trafia do backlogu powyżej.
