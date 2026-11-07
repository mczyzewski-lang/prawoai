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
